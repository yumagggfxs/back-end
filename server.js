"use strict";

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
   AUTH ADMIN
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

    /* --------------------------------------------------------
       COMPATIBILITE ANCIENNES TABLES
    -------------------------------------------------------- */

    await query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS premium BOOLEAN DEFAULT FALSE
    `);

    await query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE
    `);

    await query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS premium_until TIMESTAMP NULL
    `);

    await query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE
    `);

    await query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE
    `);

    await query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS certificats INTEGER DEFAULT 0
    `);

    await query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS photo TEXT
    `);

    await seedDemoUsers();

    console.log("Base de données initialisée.");
}

/* ============================================================
   DEMO USERS
============================================================ */

async function seedDemoUsers() {

    const countResult = await query(`
        SELECT COUNT(*)::INTEGER AS total
        FROM users
    `);

    const currentCount = countResult.rows[0].total;

    if (currentCount >= 30) {
        return;
    }

    for (let i = currentCount + 1; i <= 30; i++) {

        const email = `demo${i}@bmjservice.com`;

        await query(`
            INSERT INTO users
            (
                nom,
                email,
                telephone,
                domaine,
                password,
                premium,
                is_premium,
                blocked,
                is_blocked
            )
            VALUES
            ($1,$2,$3,$4,$5,$6,$6,$7,$7)
            ON CONFLICT (email) DO NOTHING
        `, [
            `Utilisateur Démo ${i}`,
            email,
            `+243900000${String(i).padStart(2, "0")}`,
            [
                "Informatique",
                "Marketing",
                "Leadership",
                "Finance",
                "Entrepreneuriat",
                "IA"
            ][i % 6],
            hashPassword("123456"),
            i % 5 === 0,
            false
        ]);
    }

    console.log("Utilisateurs démo vérifiés.");
}

/* ============================================================
   ROUTES GENERALES
============================================================ */

app.get("/", (req, res) => {

    res.json({
        success: true,
        name: "BMJ SERVICE API",
        status: "online",
        version: "14.0.0"
    });
});

app.get("/api", (req, res) => {

    res.json({
        success: true,
        message: "BMJ SERVICE API active",
        version: "14.0.0"
    });
});

app.get("/api/health", async (req, res) => {

    try {

        await testDatabase();

        res.json({
            success: true,
            status: "online",
            database: "connected"
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            status: "error",
            database: "disconnected",
            message: error.message
        });

    }
});

app.get("/api/test-db", async (req, res) => {

    try {

        const result = await testDatabase();

        res.json({
            success: true,
            database: "connected",
            time: result.now
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
});

/* ============================================================
   INSCRIPTION UTILISATEUR
============================================================ */

app.post("/api/register", async (req, res) => {

    try {

        const {
            nom,
            email,
            telephone,
            domaine,
            password,
            photo
        } = req.body;

        if (!nom || !email || !password) {

            return res.status(400).json({
                success: false,
                message: "Nom, email et mot de passe obligatoires"
            });

        }

        const existing = await query(
            `SELECT id FROM users WHERE LOWER(email)=LOWER($1)`,
            [email.trim()]
        );

        if (existing.rows.length) {

            return res.status(409).json({
                success: false,
                message: "Cette adresse email existe déjà"
            });
        }

        const result = await query(`
            INSERT INTO users
            (
                nom,
                email,
                telephone,
                domaine,
                password,
                photo
            )
            VALUES ($1,$2,$3,$4,$5,$6)
            RETURNING
                id,
                nom,
                email,
                telephone,
                domaine,
                photo,
                premium,
                is_premium,
                blocked,
                is_blocked,
                premium_until,
                created_at
        `, [
            nom.trim(),
            email.trim().toLowerCase(),
            telephone || null,
            domaine || null,
            hashPassword(password),
            photo || null
        ]);

        res.status(201).json({
            success: true,
            message: "Inscription réussie",
            user: result.rows[0]
        });

    } catch (error) {

        console.error("REGISTER:", error);

        res.status(500).json({
            success: false,
            message: "Erreur lors de l'inscription",
            error: error.message
        });
    }
});

/* ============================================================
   CONNEXION UTILISATEUR
============================================================ */

app.post("/api/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        if (!email || !password) {

            return res.status(400).json({
                success: false,
                message: "Email et mot de passe obligatoires"
            });
        }

        const result = await query(`
            SELECT
                id,
                nom,
                email,
                telephone,
                domaine,
                photo,
                premium,
                is_premium,
                premium_until,
                blocked,
                is_blocked,
                certificats,
                created_at
            FROM users
            WHERE LOWER(email)=LOWER($1)
            AND password=$2
            LIMIT 1
        `, [
            email.trim(),
            hashPassword(password)
        ]);

        if (!result.rows.length) {

            return res.status(401).json({
                success: false,
                message: "Email ou mot de passe incorrect"
            });
        }

        const user = result.rows[0];

        if (user.blocked || user.is_blocked) {

            return res.status(403).json({
                success: false,
                message: "Votre compte est bloqué"
            });
        }

        res.json({
            success: true,
            message: "Connexion réussie",
            user
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* ============================================================
   LOGIN ADMIN
============================================================ */

app.post("/api/admin/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        if (!email || !password) {

            return res.status(400).json({
                success: false,
                message: "Email et mot de passe obligatoires"
            });
        }

        const normalizedEmail =
            email.trim().toLowerCase();

        /*
         * ADMIN PRINCIPAL PAR VARIABLES D'ENVIRONNEMENT
         */

        const validEnvAdmin =
            normalizedEmail === ADMIN_EMAIL.toLowerCase() &&
            password === ADMIN_SECRET;

        /*
         * ADMIN JUSTIN EXISTANT DANS LA BASE
         */

        let validDatabaseAdmin = false;
        let adminUser = null;

        const result = await query(`
            SELECT *
            FROM users
            WHERE LOWER(email)=LOWER($1)
            LIMIT 1
        `, [normalizedEmail]);

        if (result.rows.length) {

            const user = result.rows[0];

            if (
                user.password === hashPassword(password) &&
                (
                    normalizedEmail === "justin@bmjservice.com" ||
                    normalizedEmail === ADMIN_EMAIL.toLowerCase()
                )
            ) {

                validDatabaseAdmin = true;
                adminUser = user;
            }
        }

        if (!validEnvAdmin && !validDatabaseAdmin) {

            return res.status(401).json({
                success: false,
                message: "Identifiants administrateur incorrects"
            });
        }

        const token = createToken();

        adminTokens.set(tokenHash(token), {
            email: normalizedEmail,
            createdAt: Date.now()
        });

        await logActivity(
            normalizedEmail,
            "ADMIN_LOGIN",
            null,
            "Connexion administrateur"
        );

        res.json({
            success: true,
            message: "Connexion administrateur réussie",

            token: token,
            adminToken: token,
            accessToken: token,

            admin: {
                email: normalizedEmail,
                nom:
                    adminUser?.nom ||
                    "Administrateur"
            }
        });

    } catch (error) {

        console.error("ADMIN LOGIN:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* ============================================================
   VERIFICATION ADMIN
============================================================ */

app.get("/api/admin/session", adminAuth, (req, res) => {

    res.json({
        success: true,
        authenticated: true,
        admin: req.admin
    });
});

/* ============================================================
   UTILISATEURS
============================================================ */

app.get("/api/admin/users", adminAuth, async (req, res) => {

    try {

        const result = await query(`
            SELECT
                u.*,
                COALESCE(
                    (
                        SELECT ROUND(AVG(cp.progression))::INTEGER
                        FROM course_progress cp
                        WHERE cp.user_id=u.id
                    ),
                    0
                ) AS progression
            FROM users u
            ORDER BY u.created_at DESC, u.id DESC
        `);

        res.json({
            success: true,
            total: result.rows.length,
            users: result.rows,
            utilisateurs: result.rows
        });

    } catch (error) {

        console.error("USERS:", error);

        res.status(500).json({
            success: false,
            message: error.message,
            users: []
        });
    }
});

/* ALIAS */

app.get("/api/admin/utilisateurs", adminAuth, async (req, res) => {

    try {

        const result = await query(`
            SELECT
                u.*,
                COALESCE(
                    (
                        SELECT ROUND(AVG(cp.progression))::INTEGER
                        FROM course_progress cp
                        WHERE cp.user_id=u.id
                    ),
                    0
                ) AS progression
            FROM users u
            ORDER BY u.created_at DESC, u.id DESC
        `);

        res.json({
            success: true,
            total: result.rows.length,
            users: result.rows,
            utilisateurs: result.rows
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message,
            users: []
        });
    }
});

app.get("/api/apprenants", adminAuth, async (req, res) => {

    try {

        const result = await query(`
            SELECT
                u.*,
                COALESCE(
                    (
                        SELECT ROUND(AVG(cp.progression))::INTEGER
                        FROM course_progress cp
                        WHERE cp.user_id=u.id
                    ),
                    0
                ) AS progression
            FROM users u
            ORDER BY u.created_at DESC
        `);

        res.json({
            success: true,
            total: result.rows.length,
            users: result.rows,
            apprenants: result.rows
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* ============================================================
   DETAIL UTILISATEUR
============================================================ */

app.get("/api/utilisateurs/:id", adminAuth, async (req, res) => {

    try {

        const result = await query(
            `SELECT * FROM users WHERE id=$1`,
            [req.params.id]
        );

        if (!result.rows.length) {

            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable"
            });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* ============================================================
   MODIFIER UTILISATEUR
============================================================ */

app.patch("/api/admin/users/:id", adminAuth, async (req, res) => {

    try {

        const id = req.params.id;

        const {
            nom,
            email,
            telephone,
            domaine,
            photo
        } = req.body;

        const result = await query(`
            UPDATE users
            SET
                nom=COALESCE($1,nom),
                email=COALESCE($2,email),
                telephone=COALESCE($3,telephone),
                domaine=COALESCE($4,domaine),
                photo=COALESCE($5,photo),
                updated_at=CURRENT_TIMESTAMP
            WHERE id=$6
            RETURNING *
        `, [
            nom,
            email,
            telephone,
            domaine,
            photo,
            id
        ]);

        if (!result.rows.length) {

            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable"
            });
        }

        await logActivity(
            req.admin.email,
            "UPDATE_USER",
            id,
            "Modification du profil utilisateur"
        );

        res.json({
            success: true,
            message: "Utilisateur modifié",
            user: result.rows[0]
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* ============================================================
   BLOQUER
============================================================ */

app.patch("/api/admin/users/:id/block", adminAuth, async (req, res) => {

    try {

        const result = await query(`
            UPDATE users
            SET
                blocked=TRUE,
                is_blocked=TRUE,
                updated_at=CURRENT_TIMESTAMP
            WHERE id=$1
            RETURNING *
        `, [req.params.id]);

        if (!result.rows.length) {

            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable"
            });
        }

        await logActivity(
            req.admin.email,
            "BLOCK_USER",
            req.params.id,
            "Utilisateur bloqué"
        );

        res.json({
            success: true,
            message: "Utilisateur bloqué",
            user: result.rows[0]
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* ============================================================
   DEBLOQUER
============================================================ */

app.patch("/api/admin/users/:id/unblock", adminAuth, async (req, res) => {

    try {

        const result = await query(`
            UPDATE users
            SET
                blocked=FALSE,
                is_blocked=FALSE,
                updated_at=CURRENT_TIMESTAMP
            WHERE id=$1
            RETURNING *
        `, [req.params.id]);

        if (!result.rows.length) {

            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable"
            });
        }

        await logActivity(
            req.admin.email,
            "UNBLOCK_USER",
            req.params.id,
            "Utilisateur débloqué"
        );

        res.json({
            success: true,
            message: "Utilisateur débloqué",
            user: result.rows[0]
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* ============================================================
   COMPATIBILITE BLOCAGE
============================================================ */

app.patch(
    "/api/admin/utilisateurs/:id/blocage",
    adminAuth,
    async (req, res) => {

        try {

            const blocked =
                req.body.blocked === true ||
                req.body.blocked === 1 ||
                req.body.blocked === "1" ||
                req.body.blocked === "true";

            const result = await query(`
                UPDATE users
                SET
                    blocked=$1,
                    is_blocked=$1,
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=$2
                RETURNING *
            `, [blocked, req.params.id]);

            if (!result.rows.length) {

                return res.status(404).json({
                    success: false,
                    message: "Utilisateur introuvable"
                });
            }

            res.json({
                success: true,
                message: blocked
                    ? "Utilisateur bloqué"
                    : "Utilisateur débloqué",
                user: result.rows[0]
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

/* ============================================================
   PREMIUM
============================================================ */

app.patch(
    "/api/admin/users/:id/premium",
    adminAuth,
    async (req, res) => {

        try {

            const days =
                Number(req.body.days) > 0
                    ? Number(req.body.days)
                    : 30;

            const result = await query(`
                UPDATE users
                SET
                    premium=TRUE,
                    is_premium=TRUE,
                    premium_until=
                        CURRENT_TIMESTAMP +
                        ($1 * INTERVAL '1 day'),
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=$2
                RETURNING *
            `, [days, req.params.id]);

            if (!result.rows.length) {

                return res.status(404).json({
                    success: false,
                    message: "Utilisateur introuvable"
                });
            }

            await logActivity(
                req.admin.email,
                "ACTIVATE_PREMIUM",
                req.params.id,
                `Premium activé pour ${days} jours`
            );

            res.json({
                success: true,
                message: "Premium activé",
                days,
                user: result.rows[0]
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

/* ============================================================
   STANDARD
============================================================ */

app.patch(
    "/api/admin/users/:id/standard",
    adminAuth,
    async (req, res) => {

        try {

            const result = await query(`
                UPDATE users
                SET
                    premium=FALSE,
                    is_premium=FALSE,
                    premium_until=NULL,
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=$1
                RETURNING *
            `, [req.params.id]);

            if (!result.rows.length) {

                return res.status(404).json({
                    success: false,
                    message: "Utilisateur introuvable"
                });
            }

            await logActivity(
                req.admin.email,
                "REMOVE_PREMIUM",
                req.params.id,
                "Utilisateur repassé en Standard"
            );

            res.json({
                success: true,
                message: "Utilisateur passé en Standard",
                user: result.rows[0]
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

/* ============================================================
   CERTIFICAT
============================================================ */

app.patch(
    "/api/admin/users/:id/certificate",
    adminAuth,
    async (req, res) => {

        try {

            const value =
                Number(req.body.certificats);

            const result = await query(`
                UPDATE users
                SET
                    certificats=GREATEST($1,0),
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=$2
                RETURNING *
            `, [
                Number.isFinite(value) ? value : 0,
                req.params.id
            ]);

            if (!result.rows.length) {

                return res.status(404).json({
                    success: false,
                    message: "Utilisateur introuvable"
                });
            }

            res.json({
                success: true,
                message: "Certificat mis à jour",
                user: result.rows[0]
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

/* ============================================================
   CERTIFICATE ACCESS
============================================================ */

app.get(
    "/api/users/:id/certificate-access",
    adminAuth,
    async (req, res) => {

        try {

            const result = await query(`
                SELECT
                    id,
                    nom,
                    email,
                    premium,
                    is_premium,
                    premium_until,
                    certificats
                FROM users
                WHERE id=$1
            `, [req.params.id]);

            if (!result.rows.length) {

                return res.status(404).json({
                    success: false,
                    message: "Utilisateur introuvable"
                });
            }

            const user=result.rows[0];

            res.json({
                success: true,
                allowed:
                    user.premium ||
                    user.is_premium ||
                    Number(user.certificats || 0)>0,
                user
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

/* ============================================================
   PAIEMENTS
============================================================ */

app.post("/api/paiements", async (req, res) => {

    try {

        const {
            user_id,
            montant,
            methode,
            reference
        } = req.body;

        const result = await query(`
            INSERT INTO paiements
            (
                user_id,
                montant,
                methode,
                reference,
                statut
            )
            VALUES ($1,$2,$3,$4,'pending')
            RETURNING *
        `, [
            user_id || null,
            montant || 0,
            methode || null,
            reference || null
        ]);

        res.status(201).json({
            success: true,
            paiement: result.rows[0]
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.get("/api/paiements", adminAuth, async (req, res) => {

    try {

        const result = await query(`
            SELECT
                p.*,
                u.nom,
                u.email
            FROM paiements p
            LEFT JOIN users u
                ON u.id=p.user_id
            ORDER BY p.created_at DESC
        `);

        res.json({
            success: true,
            total: result.rows.length,
            paiements: result.rows,
            payments: result.rows
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.get("/api/paiements/:id", adminAuth, async (req, res) => {

    try {

        const result = await query(`
            SELECT
                p.*,
                u.nom,
                u.email
            FROM paiements p
            LEFT JOIN users u
                ON u.id=p.user_id
            WHERE p.id=$1
        `, [req.params.id]);

        if (!result.rows.length) {

            return res.status(404).json({
                success: false,
                message: "Paiement introuvable"
            });
        }

        res.json({
            success: true,
            paiement: result.rows[0]
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/* ============================================================
   VALIDATION PAIEMENT
============================================================ */

app.patch(
    "/api/paiements/:id/valider",
    adminAuth,
    async (req, res) => {

        try {

            const result = await query(`
                UPDATE paiements
                SET
                    statut='validated',
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=$1
                RETURNING *
            `, [req.params.id]);

            if (!result.rows.length) {

                return res.status(404).json({
                    success: false,
                    message: "Paiement introuvable"
                });
            }

            const payment=result.rows[0];

            if(payment.user_id){

                await query(`
                    UPDATE users
                    SET
                        premium=TRUE,
                        is_premium=TRUE,
                        premium_until=
                            CURRENT_TIMESTAMP +
                            INTERVAL '30 days',
                        updated_at=CURRENT_TIMESTAMP
                    WHERE id=$1
                `, [payment.user_id]);
            }

            await logActivity(
                req.admin.email,
                "VALIDATE_PAYMENT",
                payment.user_id,
                `Paiement #${payment.id} validé`
            );

            res.json({
                success: true,
                message: "Paiement validé",
                paiement: payment
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

/* ============================================================
   REFUS PAIEMENT
============================================================ */

app.patch(
    "/api/paiements/:id/refuser",
    adminAuth,
    async (req, res) => {

        try {

            const result = await query(`
                UPDATE paiements
                SET
                    statut='refused',
                    reason=$1,
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=$2
                RETURNING *
            `, [
                req.body.reason || "Paiement refusé",
                req.params.id
            ]);

            if (!result.rows.length) {

                return res.status(404).json({
                    success: false,
                    message: "Paiement introuvable"
                });
            }

            res.json({
                success: true,
                message: "Paiement refusé",
                paiement: result.rows[0]
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

/* ============================================================
   DEMANDES DE PAIEMENT
============================================================ */

app.post("/api/demandes-paiement", async (req, res) => {

    try {

        const {
            user_id,
            telephone_paiement,
            reference_paiement,
            montant,
            methode
        } = req.body;

        if(!user_id){
            return res.status(400).json({
                success:false,
                message:"user_id obligatoire"
            });
        }

        const result = await query(`
            INSERT INTO demandes_paiement
            (
                user_id,
                telephone_paiement,
                reference_paiement,
                montant,
                methode,
                statut
            )
            VALUES ($1,$2,$3,$4,$5,'pending')
            RETURNING *
        `, [
            user_id,
            telephone_paiement || null,
            reference_paiement || null,
            montant || 0,
            methode || null
        ]);

        res.status(201).json({
            success:true,
            message:"Demande enregistrée",
            demande:result.rows[0]
        });

    } catch(error){

        res.status(500).json({
            success:false,
            message:error.message
        });
    }
});

app.get(
    "/api/demandes-paiement",
    adminAuth,
    async (req,res)=>{

        try{

            const result=await query(`
                SELECT
                    d.*,
                    u.nom,
                    u.email
                FROM demandes_paiement d
                LEFT JOIN users u
                    ON u.id=d.user_id
                ORDER BY d.created_at DESC
            `);

            res.json({
                success:true,
                total:result.rows.length,
                demandes:result.rows,
                requests:result.rows
            });

        }catch(error){

            res.status(500).json({
                success:false,
                message:error.message
            });
        }
    }
);

app.patch(
    "/api/demandes-paiement/:id/valider",
    adminAuth,
    async (req,res)=>{

        try{

            const result=await query(`
                UPDATE demandes_paiement
                SET
                    statut='validated',
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=$1
                RETURNING *
            `,[req.params.id]);

            if(!result.rows.length){

                return res.status(404).json({
                    success:false,
                    message:"Demande introuvable"
                });
            }

            const demande=result.rows[0];

            if(demande.user_id){

                await query(`
                    UPDATE users
                    SET
                        premium=TRUE,
                        is_premium=TRUE,
                        premium_until=
                            CURRENT_TIMESTAMP+
                            INTERVAL '30 days',
                        updated_at=CURRENT_TIMESTAMP
                    WHERE id=$1
                `,[demande.user_id]);
            }

            await logActivity(
                req.admin.email,
                "VALIDATE_REQUEST",
                demande.user_id,
                `Demande #${demande.id} validée`
            );

            res.json({
                success:true,
                message:"Demande validée",
                demande
            });

        }catch(error){

            res.status(500).json({
                success:false,
                message:error.message
            });
        }
    }
);

app.patch(
    "/api/demandes-paiement/:id/refuser",
    adminAuth,
    async (req,res)=>{

        try{

            const result=await query(`
                UPDATE demandes_paiement
                SET
                    statut='refused',
                    reason=$1,
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=$2
                RETURNING *
            `,[
                req.body.reason || "Demande refusée",
                req.params.id
            ]);

            if(!result.rows.length){

                return res.status(404).json({
                    success:false,
                    message:"Demande introuvable"
                });
            }

            res.json({
                success:true,
                message:"Demande refusée",
                demande:result.rows[0]
            });

        }catch(error){

            res.status(500).json({
                success:false,
                message:error.message
            });
        }
    }
);

/* ============================================================
   PROGRESSION
============================================================ */

app.patch(
    "/api/admin/users/:id/progression",
    adminAuth,
    async (req,res)=>{

        try{

            const userId=req.params.id;

            const progression=Math.max(
                0,
                Math.min(
                    100,
                    Number(req.body.progression || 0)
                )
            );

            const domaine=req.body.domaine || "Général";

            const result=await query(`
                INSERT INTO course_progress
                (
                    user_id,
                    domaine,
                    progression,
                    lessons_completed,
                    total_lessons,
                    last_lesson,
                    title,
                    completed,
                    updated_at
                )
                VALUES
                ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP)

                ON CONFLICT(user_id,domaine)
                DO UPDATE SET
                    progression=EXCLUDED.progression,
                    lessons_completed=EXCLUDED.lessons_completed,
                    total_lessons=EXCLUDED.total_lessons,
                    last_lesson=EXCLUDED.last_lesson,
                    title=EXCLUDED.title,
                    completed=EXCLUDED.completed,
                    updated_at=CURRENT_TIMESTAMP

                RETURNING *
            `,[
                userId,
                domaine,
                progression,
                Number(req.body.lessons_completed || 0),
                Number(req.body.total_lessons || 0),
                req.body.last_lesson || null,
                req.body.title || null,
                req.body.completed === true ||
                progression >= 100
            ]);

            await logActivity(
                req.admin.email,
                "UPDATE_PROGRESS",
                userId,
                `Progression ${progression}%`
            );

            res.json({
                success:true,
                message:"Progression enregistrée",
                progression:result.rows[0]
            });

        }catch(error){

            res.status(500).json({
                success:false,
                message:error.message
            });
        }
    }
);

app.get(
    "/api/admin/users/:id/progression",
    adminAuth,
    async (req,res)=>{

        try{

            const result=await query(`
                SELECT *
                FROM course_progress
                WHERE user_id=$1
                ORDER BY updated_at DESC
                LIMIT 1
            `,[req.params.id]);

            res.json({
                success:true,
                progression:
                    result.rows[0] || {
                        progression:0,
                        lessons_completed:0,
                        total_lessons:0,
                        completed:false
                    }
            });

        }catch(error){

            res.status(500).json({
                success:false,
                message:error.message
            });
        }
    }
);

app.get(
    "/api/admin/progressions",
    adminAuth,
    async (req,res)=>{

        try{

            const result=await query(`
                SELECT
                    cp.*,
                    u.nom,
                    u.email
                FROM course_progress cp
                LEFT JOIN users u
                    ON u.id=cp.user_id
                ORDER BY cp.updated_at DESC
            `);

            res.json({
                success:true,
                total:result.rows.length,
                progressions:result.rows
            });

        }catch(error){

            res.status(500).json({
                success:false,
                message:error.message
            });
        }
    }
);

/* ============================================================
   MESSAGES
============================================================ */

app.post(
    "/api/messages/send-user",
    adminAuth,
    async (req,res)=>{

        try{

            const userId=
                req.body.user_id ||
                req.body.userId;

            const content=
                req.body.content ||
                req.body.message;

            const priority=
                req.body.priority ||
                "normal";

            if(!userId || !content){

                return res.status(400).json({
                    success:false,
                    message:"Utilisateur et message obligatoires"
                });
            }

            const result=await query(`
                INSERT INTO messages
                (
                    user_id,
                    sender_type,
                    sender_id,
                    content,
                    priority,
                    read
                )
                VALUES
                ($1,'admin',NULL,$2,$3,FALSE)
                RETURNING *
            `,[
                userId,
                content,
                priority
            ]);

            await logActivity(
                req.admin.email,
                "SEND_MESSAGE",
                userId,
                "Message envoyé"
            );

            res.status(201).json({
                success:true,
                message:"Message envoyé",
                data:result.rows[0]
            });

        }catch(error){

            res.status(500).json({
                success:false,
                message:error.message
            });
        }
    }
);

app.get(
    "/api/messages",
    adminAuth,
    async (req,res)=>{

        try{

            const result=await query(`
                SELECT
                    m.*,
                    u.nom,
                    u.email
                FROM messages m
                LEFT JOIN users u
                    ON u.id=m.user_id
                ORDER BY m.created_at DESC
            `);

            res.json({
                success:true,
                total:result.rows.length,
                messages:result.rows
            });

        }catch(error){

            res.status(500).json({
                success:false,
                message:error.message
            });
        }
    }
);

app.get(
    "/api/admin/users/:id/messages",
    adminAuth,
    async (req,res)=>{

        try{

            const result=await query(`
                SELECT *
                FROM messages
                WHERE user_id=$1
                ORDER BY created_at ASC
            `,[req.params.id]);

            res.json({
                success:true,
                messages:result.rows
            });

        }catch(error){

            res.status(500).json({
                success:false,
                message:error.message
            });
        }
    }
);

app.patch(
    "/api/utilisateurs/:userId/messages/:messageId/read",
    adminAuth,
    async (req,res)=>{

        try{

            const result=await query(`
                UPDATE messages
                SET read=TRUE
                WHERE id=$1
                AND user_id=$2
                RETURNING *
            `,[
                req.params.messageId,
                req.params.userId
            ]);

            if(!result.rows.length){

                return res.status(404).json({
                    success:false,
                    message:"Message introuvable"
                });
            }

            res.json({
                success:true,
                message:"Message marqué comme lu",
                data:result.rows[0]
            });

        }catch(error){

            res.status(500).json({
                success:false,
                message:error.message
            });
        }
    }
);

app.post(
    "/api/admin/messages/reply",
    adminAuth,
    async (req,res)=>{

        try{

            const userId=req.body.user_id;
            const content=req.body.content || req.body.message;
            const replyTo=req.body.reply_to || null;

            if(!userId || !content){

                return res.status(400).json({
                    success:false,
                    message:"Utilisateur et contenu obligatoires"
                });
            }

            const result=await query(`
                INSERT INTO messages
                (
                    user_id,
                    sender_type,
                    content,
                    priority,
                    reply_to
                )
                VALUES
                ($1,'admin',$2,'normal',$3)
                RETURNING *
            `,[
                userId,
                content,
                replyTo
            ]);

            res.status(201).json({
                success:true,
                message:"Réponse envoyée",
                data:result.rows[0]
            });

        }catch(error){

            res.status(500).json({
                success:false,
                message:error.message
            });
        }
    }
);

/* ============================================================
   STATISTIQUES
============================================================ */

async function getStatistics(){

    const users=await query(`
        SELECT COUNT(*)::INTEGER AS total
        FROM users
    `);

    const premium=await query(`
        SELECT COUNT(*)::INTEGER AS total
        FROM users
        WHERE premium=TRUE OR is_premium=TRUE
    `);

    const blocked=await query(`
        SELECT COUNT(*)::INTEGER AS total
        FROM users
        WHERE blocked=TRUE OR is_blocked=TRUE
    `);

    const payments=await query(`
        SELECT
            COUNT(*)::INTEGER AS total,
            COUNT(*) FILTER(
                WHERE statut='pending'
            )::INTEGER AS pending,
            COUNT(*) FILTER(
                WHERE statut='validated'
            )::INTEGER AS validated,
            COUNT(*) FILTER(
                WHERE statut='refused'
            )::INTEGER AS refused,
            COALESCE(
                SUM(montant) FILTER(
                    WHERE statut='validated'
                ),
                0
            ) AS revenues
        FROM paiements
    `);

    const requests=await query(`
        SELECT
            COUNT(*)::INTEGER AS total,
            COUNT(*) FILTER(
                WHERE statut='pending'
            )::INTEGER AS pending,
            COUNT(*) FILTER(
                WHERE statut='validated'
            )::INTEGER AS validated,
            COUNT(*) FILTER(
                WHERE statut='refused'
            )::INTEGER AS refused
        FROM demandes_paiement
    `);

    const messages=await query(`
        SELECT
            COUNT(*)::INTEGER AS total,
            COUNT(*) FILTER(
                WHERE read=FALSE
            )::INTEGER AS unread
        FROM messages
    `);

    const progression=await query(`
        SELECT
            COUNT(*)::INTEGER AS total,
            COUNT(*) FILTER(
                WHERE completed=TRUE
            )::INTEGER AS completed,
            COALESCE(
                ROUND(AVG(progression)),
                0
            )::INTEGER AS average
        FROM course_progress
    `);

    const totalUsers=
        users.rows[0].total;

    const premiumUsers=
        premium.rows[0].total;

    return {

        utilisateurs:totalUsers,
        total_users:totalUsers,

        premium:premiumUsers,
        premium_users:premiumUsers,

        bloques:blocked.rows[0].total,
        blocked_users:blocked.rows[0].total,

        standard:
            Math.max(
                0,
                totalUsers-premiumUsers
            ),

        paiements:payments.rows[0],

        demandes:requests.rows[0],

        messages:messages.rows[0],

        progression:progression.rows[0]
    };
}

/* ============================================================
   STATISTIQUES ADMIN
============================================================ */

app.get(
    "/api/admin/statistiques",
    adminAuth,
    async (req,res)=>{

        try{

            const statistiques=
                await getStatistics();

            res.json({
                success:true,
                statistiques,
                statistics:statistiques,
                data:statistiques
            });

        }catch(error){

            res.status(500).json({
                success:false,
                message:error.message
            });
        }
    }
);

/* ============================================================
   STATISTIQUES PUBLIQUES
============================================================ */

app.get("/api/statistiques",async(req,res)=>{

    try{

        const statistiques=
            await getStatistics();

        res.json({
            success:true,
            statistiques
        });

    }catch(error){

        res.status(500).json({
            success:false,
            message:error.message
        });
    }
});

/* ============================================================
   ACTIVITES
============================================================ */

async function logActivity(
    adminEmail,
    action,
    userId,
    details
){

    try{

        await query(`
            INSERT INTO admin_activity
            (
                admin_email,
                action,
                user_id,
                details
            )
            VALUES ($1,$2,$3,$4)
        `,[
            adminEmail,
            action,
            userId || null,
            details || null
        ]);

    }catch(error){

        console.error(
            "ACTIVITY LOG:",
            error.message
        );
    }
}

app.get(
    "/api/admin/activites",
    adminAuth,
    async (req,res)=>{

        try{

            let limit=
                Number(req.query.limit || 200);

            limit=Math.max(
                1,
                Math.min(limit,500)
            );

            const result=await query(`
                SELECT *
                FROM admin_activity
                ORDER BY created_at DESC
                LIMIT $1
            `,[limit]);

            res.json({
                success:true,
                total:result.rows.length,
                activites:result.rows,
                activities:result.rows
            });

        }catch(error){

            res.status(500).json({
                success:false,
                message:error.message
            });
        }
    }
);

/* ============================================================
   ROUTES API
============================================================ */

app.get("/api/routes",async(req,res)=>{

    res.json({
        success:true,
        routes:[
            "GET /",
            "GET /api",
            "GET /api/health",
            "GET /api/test-db",

            "POST /api/register",
            "POST /api/login",

            "POST /api/admin/login",
            "GET /api/admin/session",

            "GET /api/admin/users",
            "GET /api/admin/utilisateurs",
            "GET /api/apprenants",

            "GET /api/utilisateurs/:id",
            "PATCH /api/admin/users/:id",

            "PATCH /api/admin/users/:id/block",
            "PATCH /api/admin/users/:id/unblock",

            "PATCH /api/admin/utilisateurs/:id/blocage",

            "PATCH /api/admin/users/:id/premium",
            "PATCH /api/admin/users/:id/standard",

            "PATCH /api/admin/users/:id/certificate",
            "GET /api/users/:id/certificate-access",

            "POST /api/paiements",
            "GET /api/paiements",
            "GET /api/paiements/:id",

            "PATCH /api/paiements/:id/valider",
            "PATCH /api/paiements/:id/refuser",

            "POST /api/demandes-paiement",
            "GET /api/demandes-paiement",

            "PATCH /api/demandes-paiement/:id/valider",
            "PATCH /api/demandes-paiement/:id/refuser",

            "GET /api/admin/progressions",
            "GET /api/admin/users/:id/progression",
            "PATCH /api/admin/users/:id/progression",

            "GET /api/messages",
            "POST /api/messages/send-user",
            "POST /api/admin/messages/reply",

            "GET /api/admin/users/:id/messages",

            "PATCH /api/utilisateurs/:userId/messages/:messageId/read",

            "GET /api/admin/statistiques",
            "GET /api/statistiques",

            "GET /api/admin/activites"
        ]
    });

});

/* ============================================================
   404
============================================================ */

app.use((req,res)=>{

    res.status(404).json({
        success:false,
        message:"Route introuvable",
        method:req.method,
        path:req.originalUrl
    });

});

/* ============================================================
   ERREUR GLOBALE
============================================================ */

app.use((error,req,res,next)=>{

    console.error("SERVER ERROR:",error);

    res.status(500).json({
        success:false,
        message:"Erreur interne du serveur",
        error:error.message
    });

});

/* ============================================================
   DEMARRAGE
============================================================ */

async function startServer(){

    try{

        await initDatabase();

        app.listen(PORT,()=>{

            console.log("");
            console.log("======================================");
            console.log("       BMJ SERVICE API");
            console.log("======================================");
            console.log("Port :",PORT);
            console.log("Database : CONNECTED");
            console.log("API : ONLINE");
            console.log("======================================");
            console.log("");

        });

    }catch(error){

        console.error(
            "Impossible de démarrer le serveur :",
            error
        );

        process.exit(1);
    }
}

/* ============================================================
   ARRET PROPRE
============================================================ */

process.on("SIGTERM",async()=>{

    console.log("Arrêt du serveur...");

    await pool.end();

    process.exit(0);
});

process.on("SIGINT",async()=>{

    console.log("Arrêt du serveur...");

    await pool.end();

    process.exit(0);
});

/* ============================================================
   START
============================================================ */

startServer();