/* ============================================================
   BMJ SERVICE - SERVEUR BACKEND COMPLET (EXPRESS & POSTGRESQL)
============================================================ */

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();

/* ============================================================
   CONFIGURATION & CONNEXION BASE DE DONNÉES
============================================================ */

const PORT = process.env.PORT || 10000;

const DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://name_bmj_db_user:TjgoLRbYV0LizRgBFD1nepGqSqErgBgD@dpg-dagn0e15efls73b8rjh0-a/name_bmj_db";

// Identifiants administrateur intégrés en dur directement dans le serveur
const ADMIN_EMAIL = "admin@bmjservice.com";
const ADMIN_PASSWORD = "admin123";

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

/* ============================================================
   MIDDLEWARES (CORS CONFIGURÉ STRICTEMENT POUR ÉVITER LES BLOCAGES)
============================================================ */

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Token"],
    credentials: true
}));

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// Middleware de journalisation pour voir toutes les requêtes entrantes dans les logs Render
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

/* ============================================================
   INITIALISATION AUTOMATIQUE DES TABLES POSTGRESQL
============================================================ */

async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                nom VARCHAR(255),
                email VARCHAR(255) UNIQUE NOT NULL,
                password TEXT NOT NULL,
                is_premium BOOLEAN DEFAULT FALSE,
                is_blocked BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS demandes_paiement (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                telephone_paiement VARCHAR(50),
                montant NUMERIC(10, 2) NOT NULL,
                methode VARCHAR(50) NOT NULL,
                statut VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS admin_activity (
                id SERIAL PRIMARY KEY,
                action TEXT NOT NULL,
                admin_email VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Tables PostgreSQL vérifiées / créées avec succès.");
    } catch (err) {
        console.error("Erreur lors de l'initialisation des tables PostgreSQL :", err);
    }
}

initDatabase();

/* ============================================================
   OUTILS DE CHIFFREMENT ET AUTHENTIFICATION ADMIN
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
   ROUTE DE TEST DE SANTÉ (PING POUR ÉVITER LE TIMEOUT RENDER)
============================================================ */

app.get("/", (req, res) => {
    return res.json({
        success: true,
        message: "Bienvenue sur l'API backend de BMJ SERVICE est opérationnelle !"
    });
});

app.get("/api/health", (req, res) => {
    return res.json({ success: true, status: "Server is running" });
});

/* ============================================================
   ROUTES API : AUTHENTIFICATION ADMIN (Intégrée au serveur)
============================================================ */

app.post("/api/admin/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password || email.trim() !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
            return res.status(401).json({
                success: false,
                message: "Email ou mot de passe administrateur incorrect"
            });
        }

        const token = createToken();
        const hashed = tokenHash(token);

        adminTokens.set(hashed, {
            email: ADMIN_EMAIL,
            loginAt: new Date()
        });

        return res.json({
            success: true,
            token: token,
            message: "Connexion administrateur réussie"
        });
    } catch (err) {
        console.error("Erreur login admin:", err);
        return res.status(500).json({
            success: false,
            message: "Erreur interne du serveur"
        });
    }
});

app.get("/api/admin/session", adminAuth, (req, res) => {
    return res.json({
        success: true,
        admin: req.admin
    });
});

app.delete("/api/admin/login", adminAuth, (req, res) => {
    const token = getAdminToken(req);
    if (token) {
        adminTokens.delete(tokenHash(token));
    }
    return res.json({
        success: true,
        message: "Déconnexion réussie"
    });
});

/* ============================================================
   ROUTES API : GESTION DES UTILISATEURS (ADMIN)
============================================================ */

app.get("/api/admin/users", adminAuth, async (req, res) => {
    try {
        const result = await pool.query("SELECT id, nom, email, is_premium, is_blocked, created_at FROM users ORDER BY id DESC");
        return res.json({ success: true, users: result.rows });
    } catch (err) {
        console.error("Erreur récupération utilisateurs:", err);
        return res.status(500).json({ success: false, message: "Erreur base de données" });
    }
});

app.patch("/api/admin/users/:id/block", adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("UPDATE users SET is_blocked = TRUE WHERE id = $1", [id]);
        return res.json({ success: true, message: "Utilisateur bloqué avec succès" });
    } catch (err) {
        console.error("Erreur blocage utilisateur:", err);
        return res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

app.patch("/api/admin/users/:id/unblock", adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("UPDATE users SET is_blocked = FALSE WHERE id = $1", [id]);
        return res.json({ success: true, message: "Utilisateur débloqué avec succès" });
    } catch (err) {
        console.error("Erreur déblocage utilisateur:", err);
        return res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

/* ============================================================
   ROUTES API : GESTION DES PAIEMENTS & STATISTIQUES
============================================================ */

app.get("/api/demandes-paiement", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM demandes_paiement ORDER BY id DESC");
        return res.json({ success: true, demandes: result.rows });
    } catch (err) {
        console.error("Erreur récupération demandes paiement:", err);
        return res.json({ success: true, demandes: [] });
    }
});

app.patch("/api/demandes-paiement/:id/valider", adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updateRes = await pool.query(
            "UPDATE demandes_paiement SET statut = 'valide' WHERE id = $1 RETURNING user_id",
            [id]
        );
        
        if (updateRes.rows.length > 0) {
            const userId = updateRes.rows[0].user_id;
            if (userId) {
                await pool.query("UPDATE users SET is_premium = TRUE WHERE id = $1", [userId]);
            }
        }

        return res.json({ success: true, message: "Demande validée et utilisateur passé en Premium" });
    } catch (err) {
        console.error("Erreur validation paiement:", err);
        return res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

app.get("/api/admin/statistiques", adminAuth, async (req, res) => {
    try {
        const paymentsResult = await pool.query("SELECT COUNT(*) FROM demandes_paiement");
        const usersResult = await pool.query("SELECT COUNT(*) FROM users");
        return res.json({
            success: true,
            stats: {
                users: parseInt(usersResult.rows[0].count || 0),
                payments: parseInt(paymentsResult.rows[0].count || 0)
            }
        });
    } catch (err) {
        console.error("Erreur récupération statistiques:", err);
        return res.json({ success: true, stats: { users: 0, payments: 0 } });
    }
});

/* ============================================================
   ROUTES PUBLIQUES (INSCRIPTION / CONNEXION UTILISATEURS)
============================================================ */

app.post("/api/register", async (req, res) => {
    try {
        const { nom, email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email et mot de passe requis" });
        }
        const hashedPassword = hashPassword(password);
        const result = await pool.query(
            "INSERT INTO users (nom, email, password) VALUES ($1, $2, $3) RETURNING id, nom, email, is_premium, is_blocked",
            [nom || "Client", email, hashedPassword]
        );
        return res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        console.error("Erreur inscription:", err);
        return res.status(500).json({ success: false, message: "Erreur lors de l'inscription (Email peut-être déjà utilisé)" });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = hashPassword(password);
        const result = await pool.query(
            "SELECT id, nom, email, is_premium, is_blocked FROM users WHERE email = $1 AND password = $2",
            [email, hashedPassword]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: "Identifiants utilisateur incorrects" });
        }
        const user = result.rows[0];
        if (user.is_blocked) {
            return res.status(403).json({ success: false, message: "Ce compte a été bloqué par l'administration" });
        }
        return res.json({ success: true, user });
    } catch (err) {
        console.error("Erreur connexion utilisateur:", err);
        return res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

/* ============================================================
   LANCEMENT DU SERVEUR
============================================================ */

app.listen(PORT, () => {
    console.log(`Serveur BMJ SERVICE démarré et opérationnel sur le port ${PORT}`);
});