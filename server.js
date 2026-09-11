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

/* ============================================================
   IDENTIFIANTS ADMIN DIRECTEMENT DANS LE SERVEUR
============================================================ */

const ADMIN_EMAIL = "admin@bmjservice.com";
const ADMIN_PASSWORD = "admin123";

const ADMIN_SECRET =
    "BMJ_ADMIN_SECRET_2026";

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

async function query(text, params = []) {
    return pool.query(text, params);
}

async function testDatabase() {
    const result = await query("SELECT NOW() AS now");
    return result.rows[0];
}

async function addActivity(
    adminEmail,
    action,
    userId = null,
    details = ""
) {
    try {
        await query(`
            INSERT INTO admin_activity
            (admin_email, action, user_id, details)
            VALUES ($1, $2, $3, $4)
        `, [
            adminEmail,
            action,
            userId,
            details
        ]);
    } catch (e) {
        console.error(
            "Erreur journal admin :",
            e.message
        );
    }
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

    const saved =
        adminTokens.get(tokenHash(token));

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

    const columns = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS premium BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMP NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS certificats INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT"
    ];

    for (const colQuery of columns) {
        try {
            await query(colQuery);
        } catch (e) {}
    }

    await seedDemoUsers();

    console.log(
        "Base de données initialisée avec succès."
    );
}

/* ============================================================
   UTILISATEURS DEMO
============================================================ */

async function seedDemoUsers() {

    const result = await query(`
        SELECT COUNT(*)::INTEGER AS total
        FROM users
    `);

    const currentCount =
        result.rows[0].total;

    if (currentCount >= 10) {
        return;
    }

    for (
        let i = currentCount + 1;
        i <= 10;
        i++
    ) {

        const email =
            `demo${i}@bmjservice.com`;

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
            ON CONFLICT (email)
            DO NOTHING
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
   ROUTES GENERALES
============================================================ */

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "API BMJ SERVICE en ligne"
    });
});

app.get("/api", (req, res) => {
    res.json({
        success: true,
        version: "1.0.0"
    });
});

app.get("/api/health", async (req, res) => {

    try {

        const dbTime =
            await testDatabase();

        res.json({
            success: true,
            message:
                "Serveur et base de données opérationnels",
            database: dbTime
        });

    } catch (e) {

        res.status(500).json({
            success: false,
            message:
                "Base de données indisponible",
            error: e.message
        });
    }
});

app.get("/api/test-db", async (req, res) => {

    try {

        const dbTime =
            await testDatabase();

        res.json({
            success: true,
            time: dbTime
        });

    } catch (e) {

        res.status(500).json({
            success: false,
            error: e.message
        });
    }
});

/* ============================================================
   INSCRIPTION
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

        if (
            !nom ||
            !email ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Nom, email et mot de passe obligatoires"
            });
        }

        const cleanEmail =
            String(email)
                .trim()
                .toLowerCase();

        const exists = await query(
            `
            SELECT id
            FROM users
            WHERE LOWER(email) = LOWER($1)
            `,
            [cleanEmail]
        );

        if (exists.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Cette adresse email existe déjà"
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
            VALUES
            ($1,$2,$3,$4,$5,$6)
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
                certificats,
                created_at
        `, [
            String(nom).trim(),
            cleanEmail,
            telephone || "",
            domaine || "",
            hashPassword(password),
            photo || ""
        ]);

        res.status(201).json({
            success: true,
            message:
                "Inscription réussie",
            user: result.rows[0],
            utilisateur: result.rows[0]
        });

    } catch (e) {

        res.status(500).json({
            success: false,
            message:
                "Erreur lors de l'inscription",
            error: e.message
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

        if (
            !email ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Email et mot de passe obligatoires"
            });
        }

        const result = await query(
            `
            SELECT *
            FROM users
            WHERE LOWER(email) = LOWER($1)
            `,
            [String(email).trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message:
                    "Email ou mot de passe incorrect"
            });
        }

        const user =
            result.rows[0];

        if (
            hashPassword(password) !==
            user.password
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Email ou mot de passe incorrect"
            });
        }

        if (
            user.blocked === true ||
            user.is_blocked === true
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Ce compte est bloqué"
            });
        }

        delete user.password;

        res.json({
            success: true,
            message:
                "Connexion réussie",
            user,
            utilisateur: user
        });

    } catch (e) {

        res.status(500).json({
            success: false,
            message:
                "Erreur lors de la connexion",
            error: e.message
        });
    }
});

/* ============================================================
   CONNEXION ADMIN
============================================================ */

app.post("/api/admin/login", (req, res) => {

    try {

        const email =
            String(req.body.email || "")
                .trim();

        const password =
            String(req.body.password || "");

        if (
            !email ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Email et mot de passe obligatoires"
            });
        }

        if (
            email.toLowerCase() !==
            ADMIN_EMAIL.toLowerCase()
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Email administrateur incorrect"
            });
        }

        if (
            password !==
            ADMIN_PASSWORD
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Mot de passe administrateur incorrect"
            });
        }

        const token =
            createToken();

        adminTokens.set(
            tokenHash(token),
            {
                email: ADMIN_EMAIL,
                createdAt: Date.now()
            }
        );

        console.log(
            "Connexion administrateur réussie :",
            ADMIN_EMAIL
        );

        res.json({
            success: true,
            message:
                "Connexion administrateur réussie",
            token,
            email: ADMIN_EMAIL
        });

    } catch (e) {

        res.status(500).json({
            success: false,
            message:
                "Erreur de connexion administrateur",
            error: e.message
        });
    }
});

/* ============================================================
   SESSION ADMIN
============================================================ */

app.get(
    "/api/admin/session",
    adminAuth,
    (req, res) => {

        res.json({
            success: true,
            admin: req.admin
        });
    }
);

/* ============================================================
   DECONNEXION ADMIN
============================================================ */

app.delete(
    "/api/admin/login",
    adminAuth,
    async (req, res) => {

        const token =
            getAdminToken(req);

        if (token) {
            adminTokens.delete(
                tokenHash(token)
            );
        }

        await addActivity(
            req.admin.email,
            "Déconnexion administrateur"
        );

        res.json({
            success: true,
            message:
                "Déconnexion réussie"
        });
    }
);

/* ============================================================
   UTILISATEURS ADMIN
============================================================ */

app.get(
    "/api/admin/users",
    adminAuth,
    async (req, res) => {

        try {

            const result =
                await query(`
                    SELECT *
                    FROM users
                    ORDER BY id DESC
                `);

            res.json({
                success: true,
                users: result.rows,
                utilisateurs: result.rows,
                total: result.rows.length
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                message:
                    "Impossible de récupérer les utilisateurs",
                error: e.message
            });
        }
    }
);

app.get(
    "/api/admin/utilisateurs",
    adminAuth,
    async (req, res) => {

        try {

            const result =
                await query(`
                    SELECT *
                    FROM users
                    ORDER BY id DESC
                `);

            res.json({
                success: true,
                utilisateurs: result.rows,
                users: result.rows,
                total: result.rows.length
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                message:
                    "Impossible de récupérer les utilisateurs",
                error: e.message
            });
        }
    }
);

/* ============================================================
   APPRENANTS
============================================================ */

app.get(
    "/api/apprenants",
    async (req, res) => {

        try {

            const result =
                await query(`
                    SELECT *
                    FROM users
                    ORDER BY id DESC
                `);

            res.json({
                success: true,
                apprenants: result.rows,
                utilisateurs: result.rows,
                total: result.rows.length
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

/* ============================================================
   UTILISATEUR PAR ID
============================================================ */

app.get(
    "/api/utilisateurs/:id",
    async (req, res) => {

        try {

            const result =
                await query(
                    `
                    SELECT *
                    FROM users
                    WHERE id = $1
                    `,
                    [req.params.id]
                );

            if (
                result.rows.length === 0
            ) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Utilisateur introuvable"
                });
            }

            res.json({
                success: true,
                utilisateur:
                    result.rows[0],
                user:
                    result.rows[0]
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

/* ============================================================
   BLOQUER
============================================================ */

app.patch(
    "/api/admin/users/:id/block",
    adminAuth,
    async (req, res) => {

        try {

            await query(`
                UPDATE users
                SET
                    blocked = TRUE,
                    is_blocked = TRUE,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $1
            `, [
                req.params.id
            ]);

            await addActivity(
                req.admin.email,
                "Blocage utilisateur",
                req.params.id,
                "Utilisateur bloqué"
            );

            res.json({
                success: true,
                message:
                    "Utilisateur bloqué"
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

/* ============================================================
   DEBLOQUER
============================================================ */

app.patch(
    "/api/admin/users/:id/unblock",
    adminAuth,
    async (req, res) => {

        try {

            await query(`
                UPDATE users
                SET
                    blocked = FALSE,
                    is_blocked = FALSE,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $1
            `, [
                req.params.id
            ]);

            await addActivity(
                req.admin.email,
                "Déblocage utilisateur",
                req.params.id,
                "Utilisateur débloqué"
            );

            res.json({
                success: true,
                message:
                    "Utilisateur débloqué"
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
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

            await query(`
                UPDATE users
                SET
                    premium = TRUE,
                    is_premium = TRUE,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $1
            `, [
                req.params.id
            ]);

            await addActivity(
                req.admin.email,
                "Activation Premium",
                req.params.id,
                "Utilisateur passé Premium"
            );

            res.json({
                success: true,
                message:
                    "Utilisateur passé en Premium"
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
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

            await query(`
                UPDATE users
                SET
                    premium = FALSE,
                    is_premium = FALSE,
                    premium_until = NULL,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $1
            `, [
                req.params.id
            ]);

            await addActivity(
                req.admin.email,
                "Désactivation Premium",
                req.params.id,
                "Utilisateur passé Standard"
            );

            res.json({
                success: true,
                message:
                    "Utilisateur passé en Standard"
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
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

            await query(`
                UPDATE users
                SET
                    certificats =
                        COALESCE(certificats, 0) + 1,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $1
            `, [
                req.params.id
            ]);

            await addActivity(
                req.admin.email,
                "Certificat accordé",
                req.params.id,
                "Certificat accordé"
            );

            res.json({
                success: true,
                message:
                    "Certificat accordé"
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

/* ============================================================
   PAIEMENTS
============================================================ */

app.get(
    "/api/paiements",
    async (req, res) => {

        try {

            const result =
                await query(`
                    SELECT *
                    FROM paiements
                    ORDER BY id DESC
                `);

            res.json({
                success: true,
                paiements: result.rows,
                total: result.rows.length
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

app.post(
    "/api/paiements",
    async (req, res) => {

        try {

            const {
                user_id,
                montant,
                methode,
                reference
            } = req.body;

            const result =
                await query(`
                    INSERT INTO paiements
                    (
                        user_id,
                        montant,
                        methode,
                        reference,
                        statut
                    )
                    VALUES
                    ($1,$2,$3,$4,'pending')
                    RETURNING *
                `, [
                    user_id,
                    montant || 0,
                    methode || "",
                    reference || ""
                ]);

            res.status(201).json({
                success: true,
                paiement:
                    result.rows[0]
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

/* ============================================================
   DEMANDES PAIEMENT
============================================================ */

app.get(
    "/api/demandes-paiement",
    async (req, res) => {

        try {

            const result =
                await query(`
                    SELECT
                        d.*,
                        u.nom
                            AS utilisateur_nom,
                        u.email
                            AS utilisateur_email
                    FROM demandes_paiement d
                    LEFT JOIN users u
                        ON u.id = d.user_id
                    ORDER BY d.id DESC
                `);

            res.json({
                success: true,
                demandes:
                    result.rows,
                demandes_paiement:
                    result.rows,
                total:
                    result.rows.length
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

app.post(
    "/api/demandes-paiement",
    async (req, res) => {

        try {

            const {
                user_id,
                telephone_paiement,
                reference_paiement,
                montant,
                methode
            } = req.body;

            const result =
                await query(`
                    INSERT INTO demandes_paiement
                    (
                        user_id,
                        telephone_paiement,
                        reference_paiement,
                        montant,
                        methode,
                        statut
                    )
                    VALUES
                    ($1,$2,$3,$4,$5,'pending')
                    RETURNING *
                `, [
                    user_id,
                    telephone_paiement || "",
                    reference_paiement || "",
                    montant || 0,
                    methode || ""
                ]);

            res.status(201).json({
                success: true,
                demande:
                    result.rows[0]
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

/* ============================================================
   VALIDER PAIEMENT
============================================================ */

app.patch(
    "/api/demandes-paiement/:id/valider",
    adminAuth,
    async (req, res) => {

        try {

            const demande =
                await query(`
                    SELECT *
                    FROM demandes_paiement
                    WHERE id = $1
                `, [
                    req.params.id
                ]);

            if (
                demande.rows.length === 0
            ) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Demande de paiement introuvable"
                });
            }

            const data =
                demande.rows[0];

            await query(`
                UPDATE demandes_paiement
                SET
                    statut = 'valide',
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $1
            `, [
                req.params.id
            ]);

            if (data.user_id) {

                await query(`
                    UPDATE users
                    SET
                        premium = TRUE,
                        is_premium = TRUE,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [
                    data.user_id
                ]);
            }

            await addActivity(
                req.admin.email,
                "Paiement validé",
                data.user_id,
                "Paiement validé et Premium activé"
            );

            res.json({
                success: true,
                message:
                    "Paiement validé et Premium activé"
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

/* ============================================================
   REFUSER PAIEMENT
============================================================ */

app.patch(
    "/api/demandes-paiement/:id/refuser",
    adminAuth,
    async (req, res) => {

        try {

            const demande =
                await query(`
                    SELECT *
                    FROM demandes_paiement
                    WHERE id = $1
                `, [
                    req.params.id
                ]);

            if (
                demande.rows.length === 0
            ) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Demande de paiement introuvable"
                });
            }

            await query(`
                UPDATE demandes_paiement
                SET
                    statut = 'refuse',
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $1
            `, [
                req.params.id
            ]);

            await addActivity(
                req.admin.email,
                "Paiement refusé",
                demande.rows[0].user_id,
                "Demande de paiement refusée"
            );

            res.json({
                success: true,
                message:
                    "Demande refusée"
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

/* ============================================================
   STATISTIQUES
============================================================ */

app.get(
    "/api/admin/statistiques",
    adminAuth,
    async (req, res) => {

        try {

            const users =
                await query(`
                    SELECT COUNT(*)::INTEGER
                    AS total
                    FROM users
                `);

            const premium =
                await query(`
                    SELECT COUNT(*)::INTEGER
                    AS total
                    FROM users
                    WHERE premium = TRUE
                       OR is_premium = TRUE
                `);

            const blocked =
                await query(`
                    SELECT COUNT(*)::INTEGER
                    AS total
                    FROM users
                    WHERE blocked = TRUE
                       OR is_blocked = TRUE
                `);

            const payments =
                await query(`
                    SELECT COUNT(*)::INTEGER
                    AS total
                    FROM paiements
                    WHERE LOWER(statut) = 'valide'
                `);

            const pending =
                await query(`
                    SELECT COUNT(*)::INTEGER
                    AS total
                    FROM demandes_paiement
                    WHERE LOWER(statut) = 'pending'
                `);

            const certificates =
                await query(`
                    SELECT
                        COALESCE(
                            SUM(certificats),
                            0
                        )::INTEGER AS total
                    FROM users
                `);

            res.json({
                success: true,
                stats: {
                    users:
                        users.rows[0].total,
                    utilisateurs:
                        users.rows[0].total,
                    premium:
                        premium.rows[0].total,
                    blocked:
                        blocked.rows[0].total,
                    payments:
                        payments.rows[0].total,
                    pendingPayments:
                        pending.rows[0].total,
                    demandes:
                        pending.rows[0].total,
                    certificates:
                        certificates.rows[0].total
                }
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                message:
                    "Impossible de récupérer les statistiques",
                error: e.message
            });
        }
    }
);

/* ============================================================
   ACTIVITES ADMIN
============================================================ */

app.get(
    "/api/admin/activites",
    adminAuth,
    async (req, res) => {

        try {

            const result =
                await query(`
                    SELECT *
                    FROM admin_activity
                    ORDER BY id DESC
                    LIMIT 50
                `);

            res.json({
                success: true,
                activites:
                    result.rows,
                activities:
                    result.rows
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

/* ============================================================
   MESSAGES
============================================================ */

app.get(
    "/api/messages",
    async (req, res) => {

        try {

            const result =
                await query(`
                    SELECT *
                    FROM messages
                    ORDER BY id DESC
                `);

            res.json({
                success: true,
                messages:
                    result.rows
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

app.post(
    "/api/admin/messages/reply",
    adminAuth,
    async (req, res) => {

        try {

            const {
                userId,
                message
            } = req.body;

            if (
                !message ||
                !String(message).trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Le message est obligatoire"
                });
            }

            const result =
                await query(`
                    INSERT INTO messages
                    (
                        user_id,
                        sender_type,
                        sender_id,
                        content
                    )
                    VALUES
                    ($1,'admin',NULL,$2)
                    RETURNING *
                `, [
                    userId || null,
                    String(message).trim()
                ]);

            await addActivity(
                req.admin.email,
                "Message envoyé",
                userId || null,
                "Réponse administrateur envoyée"
            );

            res.json({
                success: true,
                message:
                    result.rows[0]
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

/* ============================================================
   LISTE DES ROUTES
============================================================ */

app.get(
    "/api/routes",
    async (req, res) => {

        res.json({
            success: true,
            routes: [
                "GET /",
                "GET /api",
                "GET /api/health",
                "GET /api/test-db",
                "POST /api/register",
                "POST /api/login",
                "POST /api/admin/login",
                "GET /api/admin/session",
                "DELETE /api/admin/login",
                "GET /api/admin/users",
                "GET /api/admin/utilisateurs",
                "GET /api/apprenants",
                "GET /api/utilisateurs/:id",
                "PATCH /api/admin/users/:id/block",
                "PATCH /api/admin/users/:id/unblock",
                "PATCH /api/admin/users/:id/premium",
                "PATCH /api/admin/users/:id/standard",
                "PATCH /api/admin/users/:id/certificate",
                "GET /api/paiements",
                "POST /api/paiements",
                "GET /api/demandes-paiement",
                "POST /api/demandes-paiement",
                "PATCH /api/demandes-paiement/:id/valider",
                "PATCH /api/demandes-paiement/:id/refuser",
                "GET /api/admin/statistiques",
                "GET /api/admin/activites",
                "GET /api/messages",
                "POST /api/admin/messages/reply"
            ]
        });
    }
);

/* ============================================================
   ROUTE 404
============================================================ */

app.use((req, res) => {

    res.status(404).json({
        success: false,
        message:
            "Route introuvable",
        path: req.originalUrl
    });
});

/* ============================================================
   LANCEMENT DU SERVEUR
============================================================ */

initDatabase()
    .then(() => {

        app.listen(
            PORT,
            () => {

                console.log(
                    `Serveur BMJ SERVICE démarré sur le port ${PORT}`
                );

                console.log(
                    `Email administrateur : ${ADMIN_EMAIL}`
                );

                console.log(
                    "Authentification administrateur configurée."
                );
            }
        );

    })
    .catch((err) => {

        console.error(
            "Erreur critique au démarrage :",
            err
        );

        process.exit(1);
    });