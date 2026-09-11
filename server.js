/* ============================================================
   BMJ SERVICE - BACKEND COMPLET ET OPTIMISÉ
   Node.js + Express + PostgreSQL
============================================================ */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();

/* ============================================================
   CONFIGURATION (Identifiants intégrés directement en dur)
============================================================ */

const PORT = process.env.PORT || 10000;

const DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://name_bmj_db_user:TjgoLRbYV0LizRgBFD1nepGqSqErgBgD@dpg-dagn0e15efls73b8rjh0-a/name_bmj_db";

// Identifiants admin intégrés directement (priorité absolue dans le code, sans passer par les variables d'environnement de Render)
const ADMIN_EMAIL = "admin@bmjservice.com";
const ADMIN_PASSWORD = "admin123";

const ADMIN_SECRET = "BMJ_ADMIN_SECRET_CHANGE_ME_2026";

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

/* ============================================================
   MIDDLEWARE
============================================================ */

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Token"]
}));

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

/* ============================================================
   OUTILS DE CHIFFREMENT ET AUTHENTIFICATION
============================================================ */

function hashPassword(password) {
    return crypto
        .createHash("sha256")
        .update(String(password))
        .digest("hex");
}

function createToken() {
    return crypto.randomBytes(48).toString("hex");
}

function tokenHash(token) {
    return crypto
        .createHash("sha256")
        .update(String(token))
        .digest("hex");
}

function getAdminToken(req) {
    const authorization = req.headers.authorization || "";
    if (authorization.startsWith("Bearer ")) {
        return authorization.substring(7).trim();
    }
    if (req.headers["x-admin-token"]) {
        return String(req.headers["x-admin-token"]).trim();
    }
    if (req.query.token) {
        return String(req.query.token).trim();
    }
    return null;
}

const adminTokens = new Map();

function adminAuth(req, res, next) {
    const token = getAdminToken(req);
    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Token administrateur manquant"
        });
    }

    const saved = adminTokens.get(tokenHash(token));
    if (!saved) {
        return res.status(401).json({
            success: false,
            message: "Token administrateur invalide ou expiré"
        });
    }

    req.admin = saved;
    next();
}
/* ============================================================
   GESTION BASE DE DONNÉES & INITIALISATION
============================================================ */

async function query(text, params = []) {
    return pool.query(text, params);
}

async function testDatabase() {
    const result = await query("SELECT NOW() AS now");
    return result.rows[0];
}

async function initDatabase() {
    // 1. Création des tables principales si elles n'existent pas
    await query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            nom VARCHAR(150),
            email VARCHAR(255) UNIQUE NOT NULL,
            telephone VARCHAR(50),
            domaine VARCHAR(150),
            password TEXT,
            photo TEXT,
            premium BOOLEAN DEFAULT FALSE,
            is_premium BOOLEAN DEFAULT FALSE,
            premium_until TIMESTAMP NULL,
            blocked BOOLEAN DEFAULT FALSE,
            is_blocked BOOLEAN DEFAULT FALSE,
            certificats INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS paiements (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            montant NUMERIC(12,2) DEFAULT 0,
            methode VARCHAR(100),
            reference VARCHAR(255),
            statut VARCHAR(50) DEFAULT 'pending',
            reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS demandes_paiement (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            telephone_paiement VARCHAR(100),
            reference_paiement VARCHAR(255),
            montant NUMERIC(12,2) DEFAULT 0,
            methode VARCHAR(100),
            statut VARCHAR(50) DEFAULT 'pending',
            reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS course_progress (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            domaine VARCHAR(150),
            progression INTEGER DEFAULT 0,
            lessons_completed INTEGER DEFAULT 0,
            total_lessons INTEGER DEFAULT 0,
            last_lesson TEXT,
            title TEXT,
            completed BOOLEAN DEFAULT FALSE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, domaine)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            sender_type VARCHAR(50) DEFAULT 'admin',
            sender_id INTEGER,
            content TEXT NOT NULL,
            priority VARCHAR(30) DEFAULT 'normal',
            read BOOLEAN DEFAULT FALSE,
            reply_to INTEGER NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS admin_activity (
            id SERIAL PRIMARY KEY,
            admin_email VARCHAR(255),
            action VARCHAR(150),
            user_id INTEGER NULL,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 2. Assurer la compatibilité avec toutes les anciennes colonnes
    const alterations = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS premium BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMP NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS certificats INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT"
    ];

    for (const alt of alterations) {
        try { await query(alt); } catch (e) {}
    }

    // 3. Injection / Intégration des anciennes et nouvelles données (Seeding complet)
    await seedAllData();

    console.log("Base de données initialisée et synchronisée avec succès.");
}

async function seedAllData() {
    // Insertion de données de test enrichies (anciens + nouveaux profils réalistes)
    const seedProfiles = [
        { nom: "Christian Mwamba", email: "christian.mwamba@bmjservice.com", tel: "+243991234567", domaine: "Informatique", premium: true, certificats: 2 },
        { nom: "Sarah Tshilombo", email: "sarah.tshilombo@bmjservice.com", tel: "+243818901234", domaine: "Marketing", premium: false, certificats: 1 },
        { nom: "Héritier Kabuya", email: "heritier.kabuya@bmjservice.com", tel: "+243975432109", domaine: "Entrepreneuriat", premium: true, certificats: 3 },
        { nom: "Grace Mutombo", email: "grace.mutombo@bmjservice.com", tel: "+243823456789", domaine: "IA", premium: false, certificats: 0 },
        { nom: "Patient Ilunga", email: "patient.ilunga@bmjservice.com", tel: "+243998877665", domaine: "Finance", premium: true, certificats: 4 }
    ];

    for (const p of seedProfiles) {
        await query(`
            INSERT INTO users (nom, email, telephone, domaine, password, premium, is_premium, certificats)
            VALUES ($1, $2, $3, $4, $5, $6, $6, $7)
            ON CONFLICT (email) DO NOTHING
        `, [p.nom, p.email, p.tel, p.domaine, hashPassword("123456"), p.premium, p.certificats]);
    }

    // Génération automatique d'utilisateurs démo supplémentaires (jusqu'à 20) si la table est vide ou incomplète
    const countRes = await query("SELECT COUNT(*)::INTEGER AS total FROM users");
    const currentTotal = countRes.rows[0].total;

    if (currentTotal < 20) {
        for (let i = currentTotal + 1; i <= 20; i++) {
            const email = `apprenant${i}@bmjservice.com`;
            await query(`
                INSERT INTO users (nom, email, telephone, domaine, password, premium, is_premium, certificats)
                VALUES ($1, $2, $3, $4, $5, $6, $6, $7)
                ON CONFLICT (email) DO NOTHING
            `, [
                `Apprenant Test ${i}`,
                email,
                `+243890000${String(i).padStart(2, "0")}`,
                ["Informatique", "Marketing", "Leadership", "Finance", "Entrepreneuriat", "IA"][i % 6],
                hashPassword("123456"),
                i % 3 === 0,
                i % 4 === 0 ? 1 : 0
            ]);
        }
    }

    // Ajout de quelques demandes de paiement par défaut si la table est vide
    const payCheck = await query("SELECT COUNT(*)::INTEGER AS total FROM demandes_paiement");
    if (payCheck.rows[0].total === 0) {
        await query(`
            INSERT INTO demandes_paiement (user_id, telephone_paiement, reference_paiement, montant, methode, statut)
            VALUES 
            (1, '+243991234567', 'REF-BMJ-99881', 15.00, 'Airtel Money', 'pending'),
            (2, '+243818901234', 'REF-BMJ-55432', 25.00, 'Orange Money', 'pending'),
            (3, '+243975432109', 'REF-BMJ-77123', 15.00, 'M-Pesa', 'valide')
        `);
    }
}

/* ============================================================
   ROUTES API COMPLÈTES & ROBUSTES
============================================================ */

app.get("/", (req, res) => {
    res.json({ success: true, message: "API BMJ SERVICE active et opérationnelle." });
});

app.get("/api", (req, res) => {
    res.json({ success: true, version: "2.0.0", service: "BMJ Backend" });
});

app.get("/api/health", async (req, res) => {
    try {
        const dbTime = await testDatabase();
        res.json({ success: true, database: dbTime, status: "healthy" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Authentification Admin
app.post("/api/admin/login", (req, res) => {
    const { email, password } = req.body;
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        const token = createToken();
        adminTokens.set(tokenHash(token), { email: ADMIN_EMAIL });
        return res.json({ success: true, token, email: ADMIN_EMAIL, message: "Connexion réussie" });
    }
    res.status(401).json({ success: false, message: "Email ou mot de passe administrateur incorrect" });
});

app.get("/api/admin/session", adminAuth, (req, res) => {
    res.json({ success: true, admin: req.admin });
});

app.delete("/api/admin/login", adminAuth, (req, res) => {
    const token = getAdminToken(req);
    if (token) adminTokens.delete(tokenHash(token));
    res.json({ success: true, message: "Déconnexion effectuée" });
});

// Gestion des Utilisateurs / Apprenants
app.get("/api/admin/users", adminAuth, async (req, res) => {
    try {
        const result = await query("SELECT * FROM users ORDER BY id DESC");
        res.json({ success: true, users: result.rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get("/api/admin/utilisateurs", adminAuth, async (req, res) => {
    try {
        const result = await query("SELECT * FROM users ORDER BY id DESC");
        res.json({ success: true, utilisateurs: result.rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get("/api/apprenants", async (req, res) => {
    try {
        const result = await query("SELECT * FROM users ORDER BY id DESC");
        res.json({ success: true, apprenants: result.rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get("/api/utilisateurs/:id", async (req, res) => {
    try {
        const result = await query("SELECT * FROM users WHERE id = $1", [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Utilisateur introuvable" });
        res.json({ success: true, utilisateur: result.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Actions Admin sur les utilisateurs
app.patch("/api/admin/users/:id/block", adminAuth, async (req, res) => {
    try {
        await query("UPDATE users SET blocked = TRUE, is_blocked = TRUE WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "Utilisateur bloqué avec succès" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.patch("/api/admin/users/:id/unblock", adminAuth, async (req, res) => {
    try {
        await query("UPDATE users SET blocked = FALSE, is_blocked = FALSE WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "Utilisateur débloqué avec succès" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.patch("/api/admin/users/:id/premium", adminAuth, async (req, res) => {
    try {
        await query("UPDATE users SET premium = TRUE, is_premium = TRUE WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "Statut Premium activé" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.patch("/api/admin/users/:id/standard", adminAuth, async (req, res) => {
    try {
        await query("UPDATE users SET premium = FALSE, is_premium = FALSE WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "Statut Standard appliqué" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Paiements et Demandes de paiement
app.get("/api/paiements", async (req, res) => {
    try {
        const result = await query("SELECT * FROM paiements ORDER BY id DESC");
        res.json({ success: true, paiements: result.rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get("/api/demandes-paiement", async (req, res) => {
    try {
        const result = await query("SELECT * FROM demandes_paiement ORDER BY id DESC");
        res.json({ success: true, demandes: result.rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post("/api/demandes-paiement", async (req, res) => {
    try {
        const { user_id, telephone_paiement, reference_paiement, montant, methode } = req.body;
        const result = await query(`
            INSERT INTO demandes_paiement (user_id, telephone_paiement, reference_paiement, montant, methode, statut)
            VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *
        `, [user_id || 1, telephone_paiement, reference_paiement, montant, methode]);
        res.json({ success: true, demande: result.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.patch("/api/demandes-paiement/:id/valider", adminAuth, async (req, res) => {
    try {
        await query("UPDATE demandes_paiement SET statut = 'valide' WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "Demande de paiement validée" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.patch("/api/demandes-paiement/:id/refuser", adminAuth, async (req, res) => {
    try {
        await query("UPDATE demandes_paiement SET statut = 'refuse' WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "Demande de paiement refusée" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Statistiques et Activités Administratives
app.get("/api/admin/statistiques", adminAuth, async (req, res) => {
    try {
        const usersCount = await query("SELECT COUNT(*)::INTEGER AS total FROM users");
        const paymentsCount = await query("SELECT COUNT(*)::INTEGER AS total FROM demandes_paiement WHERE statut = 'valide'");
        const pendingCount = await query("SELECT COUNT(*)::INTEGER AS total FROM demandes_paiement WHERE statut = 'pending'");
        res.json({
            success: true,
            stats: {
                users: usersCount.rows[0].total,
                payments: paymentsCount.rows[0].total,
                pending: pendingCount.rows[0].total
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get("/api/messages", async (req, res) => {
    try {
        const result = await query("SELECT * FROM messages ORDER BY id DESC");
        res.json({ success: true, messages: result.rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Route globale de listing d'API
app.get("/api/routes", async (req, res) => {
    res.json({
        success: true,
        endpoints: [
            "GET /", "GET /api/health", "POST /api/admin/login",
            "GET /api/admin/users", "GET /api/apprenants",
            "GET /api/demandes-paiement", "POST /api/demandes-paiement",
            "PATCH /api/demandes-paiement/:id/valider", "GET /api/admin/statistiques"
        ]
    });
});

/* ============================================================
   LANCEMENT DU SERVEUR
============================================================ */

initDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Serveur BMJ SERVICE démarré et prêt sur le port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error("❌ Erreur critique lors de l'initialisation de la base de données :", err);
    });s