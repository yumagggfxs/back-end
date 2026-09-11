/* ============================================================
   BMJ SERVICE - BACKEND COMPLET
   Node.js + Express + PostgreSQL
============================================================ */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();

/* ============================================================
   CONFIGURATION
============================================================ */

const PORT = process.env.PORT || 10000;

const DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://name_bmj_db_user:TjgoLRbYV0LizRgBFD1nepGqSqErgBgD@dpg-dagn0e15efls73b8rjh0-a/name_bmj_db";

const ADMIN_EMAIL =
    process.env.ADMIN_EMAIL ||
    "admin@bmjservice.com";

const ADMIN_PASSWORD = "admin123"; // Mot de passe par défaut demandé

const ADMIN_SECRET =
    process.env.ADMIN_SECRET ||
    "BMJ_ADMIN_SECRET_CHANGE_ME_2026";

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
    methods: [
        "GET",
        "POST",
        "PATCH",
        "PUT",
        "DELETE",
        "OPTIONS"
    ],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Admin-Token"
    ]
}));

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

/* ============================================================
   OUTILS
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

/* ============================================================
   TOKENS ADMIN EN MEMOIRE
============================================================ */

const adminTokens = new Map();

/* ============================================================
   AUTH ADMIN MIDDLEWARE
============================================================ */

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
   DATABASE
============================================================ */

async function query(text, params = []) {
    return pool.query(text, params);
}

async function testDatabase() {
    const result = await query("SELECT NOW() AS now");
    return result.rows[0];
}

/* ============================================================
   CREATION DES TABLES
============================================================ */

async function initDatabase() {
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

    // Compatibilité colonnes
    const columns = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS premium BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMP NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS certificats INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT"
    ];
    for (let colQuery of columns) {
        try { await query(colQuery); } catch (e) {}
    }

    await seedDemoUsers();
    console.log("Base de données initialisée avec succès.");
}

async function seedDemoUsers() {
    const countResult = await query("SELECT COUNT(*)::INTEGER AS total FROM users");
    const currentCount = countResult.rows[0].total;

    if (currentCount >= 10) return;

    for (let i = currentCount + 1; i <= 10; i++) {
        const email = `demo${i}@bmjservice.com`;
        await query(`
            INSERT INTO users (nom, email, telephone, domaine, password, premium, is_premium, blocked, is_blocked)
            VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $7)
            ON CONFLICT (email) DO NOTHING
        `, [
            `Utilisateur Démo ${i}`,
            email,
            `+243900000${String(i).padStart(2, "0")}`,
            "Informatique",
            hashPassword("123456"),
            i % 2 === 0,
            false
        ]);
    }
}

/* ============================================================
   ROUTES API COMPLÈTES
============================================================ */

app.get("/", (req, res) => {
    res.json({ success: true, message: "API BMJ SERVICE en ligne" });
});

app.get("/api", (req, res) => {
    res.json({ success: true, version: "1.0.0" });
});

app.get("/api/health", async (req, res) => {
    try {
        const dbTime = await testDatabase();
        res.json({ success: true, database: dbTime });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get("/api/test-db", async (req, res) => {
    try {
        const dbTime = await testDatabase();
        res.json({ success: true, time: dbTime });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Auth Admin
app.post("/api/admin/login", (req, res) => {
    const { email, password } = req.body;
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        const token = createToken();
        adminTokens.set(tokenHash(token), { email: ADMIN_EMAIL });
        return res.json({ success: true, token, email: ADMIN_EMAIL });
    }
    res.status(401).json({ success: false, message: "Identifiants administrateur invalides" });
});

app.get("/api/admin/session", adminAuth, (req, res) => {
    res.json({ success: true, admin: req.admin });
});

app.delete("/api/admin/login", adminAuth, (req, res) => {
    const token = getAdminToken(req);
    if (token) adminTokens.delete(tokenHash(token));
    res.json({ success: true, message: "Déconnexion réussie" });
});

// Utilisateurs & Apprenants
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

app.patch("/api/admin/users/:id/block", adminAuth, async (req, res) => {
    try {
        await query("UPDATE users SET blocked = TRUE, is_blocked = TRUE WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "Utilisateur bloqué" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.patch("/api/admin/users/:id/unblock", adminAuth, async (req, res) => {
    try {
        await query("UPDATE users SET blocked = FALSE, is_blocked = FALSE WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "Utilisateur débloqué" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.patch("/api/admin/users/:id/premium", adminAuth, async (req, res) => {
    try {
        await query("UPDATE users SET premium = TRUE, is_premium = TRUE WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "Passé en premium" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.patch("/api/admin/users/:id/standard", adminAuth, async (req, res) => {
    try {
        await query("UPDATE users SET premium = FALSE, is_premium = FALSE WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "Passé en standard" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.patch("/api/admin/users/:id/certificate", adminAuth, async (req, res) => {
    try {
        await query("UPDATE users SET certificats = certificats + 1 WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "Certificat accordé" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Paiements & Demandes
app.get("/api/paiements", async (req, res) => {
    try {
        const result = await query("SELECT * FROM paiements ORDER BY id DESC");
        res.json({ success: true, paiements: result.rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post("/api/paiements", async (req, res) => {
    try {
        const { user_id, montant, methode, reference } = req.body;
        const result = await query(`
            INSERT INTO paiements (user_id, montant, methode, reference, statut)
            VALUES ($1, $2, $3, $4, 'pending') RETURNING *
        `, [user_id, montant, methode, reference]);
        res.json({ success: true, paiement: result.rows[0] });
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
        `, [user_id, telephone_paiement, reference_paiement, montant, methode]);
        res.json({ success: true, demande: result.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.patch("/api/demandes-paiement/:id/valider", adminAuth, async (req, res) => {
    try {
        await query("UPDATE demandes_paiement SET statut = 'valide' WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "Demande validée" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.patch("/api/demandes-paiement/:id/refuser", adminAuth, async (req, res) => {
    try {
        await query("UPDATE demandes_paiement SET statut = 'refuse' WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "Demande refusée" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Statistiques & Activités
app.get("/api/admin/statistiques", adminAuth, async (req, res) => {
    try {
        const usersCount = await query("SELECT COUNT(*)::INTEGER AS total FROM users");
        const paymentsCount = await query("SELECT COUNT(*)::INTEGER AS total FROM paiements WHERE statut = 'valide'");
        res.json({
            success: true,
            stats: {
                users: usersCount.rows[0].total,
                payments: paymentsCount.rows[0].total
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get("/api/admin/activites", adminAuth, async (req, res) => {
    try {
        const result = await query("SELECT * FROM admin_activity ORDER BY id DESC LIMIT 50");
        res.json({ success: true, activites: result.rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Messagerie
app.get("/api/messages", async (req, res) => {
    try {
        const result = await query("SELECT * FROM messages ORDER BY id DESC");
        res.json({ success: true, messages: result.rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post("/api/admin/messages/reply", adminAuth, async (req, res) => {
    try {
        const { userId, message } = req.body;
        const result = await query(`
            INSERT INTO messages (user_id, sender_type, content)
            VALUES ($1, 'admin', $2) RETURNING *
        `, [userId, message]);
        res.json({ success: true, message: result.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Liste des routes globales demandée au début
app.get("/api/routes", async (req, res) => {
    res.json({
        success: true,
        routes: [
            "GET /", "GET /api", "GET /api/health", "GET /api/test-db",
            "POST /api/register", "POST /api/login",
            "POST /api/admin/login", "GET /api/admin/session",
            "GET /api/admin/users", "GET /api/admin/utilisateurs", "GET /api/apprenants",
            "GET /api/utilisateurs/:id", "PATCH /api/admin/users/:id",
            "PATCH /api/admin/users/:id/block", "PATCH /api/admin/users/:id/unblock",
            "PATCH /api/admin/users/:id/premium", "PATCH /api/admin/users/:id/standard",
            "PATCH /api/admin/users/:id/certificate", "POST /api/paiements",
            "GET /api/paiements", "POST /api/demandes-paiement", "GET /api/demandes-paiement",
            "PATCH /api/demandes-paiement/:id/valider", "PATCH /api/demandes-paiement/:id/refuser",
            "GET /api/admin/statistiques", "GET /api/admin/activites", "GET /api/messages"
        ]
    });
});

/* ============================================================
   LANCEMENT DU SERVEUR
============================================================ */

initDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Serveur démarré sur le port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error("Erreur critique au démarrage :", err);
    });