// ============================================================
// BMJ SERVICE — SERVEUR COMPLET
// Node.js + Express + PostgreSQL
// ============================================================

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const crypto = require("crypto");

// ============================================================
// CONFIGURATION
// ============================================================

const app = express();

const PORT = process.env.PORT || 10000;

// IMPORTANT : pour ce test, la connexion peut être mise ici.
// Après fonctionnement, il est fortement recommandé de la mettre
// dans DATABASE_URL sur Render et de changer le mot de passe PostgreSQL.
const DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://name_bmj_db_user:TjgoLRbYV0LizRgBFD1nepGqSqErgBgD@dpg-dagn0e15efls73b8rjh0-a/name_bmj_db";

// ============================================================
// ADMIN PRINCIPAL
// ============================================================

const ADMIN_EMAIL =
    process.env.ADMIN_EMAIL || "admin@bmjservice.com";

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "BMJ_Admin_2026!";

const ADMIN_SECRET =
    process.env.ADMIN_SECRET ||
    "BMJ_SERVICE_SECRET_2026_CHANGE_ME";

// ============================================================
// COMPTE AUTOMATIQUE MUSSIWA JUSTIN
// ============================================================

const JUSTIN_NAME = "MUSSIWA JUSTIN";
const JUSTIN_EMAIL = "mussiwajustin@gmail.com";

const JUSTIN_PASSWORD =
    process.env.JUSTIN_ADMIN_PASSWORD ||
    "Justin_BMJ_2026!";

// ============================================================
// POSTGRESQL
// ============================================================

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

// ============================================================
// MIDDLEWARES
// ============================================================

app.use(
    cors({
        origin: true,
        credentials: false,
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "Accept",
            "X-Admin-Token"
        ],
        methods: [
            "GET",
            "POST",
            "PATCH",
            "PUT",
            "DELETE",
            "OPTIONS"
        ]
    })
);

app.use(
    express.json({
        limit: "20mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "20mb"
    })
);

// ============================================================
// LOGGER
// ============================================================

app.use((req, res, next) => {
    console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`
    );

    next();
});

// ============================================================
// OUTILS
// ============================================================

function normalizeEmail(email) {
    return String(email || "")
        .trim()
        .toLowerCase();
}

function cleanString(value) {
    if (value === undefined || value === null) {
        return "";
    }

    return String(value).trim();
}

function parseId(value) {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
}

function success(res, data = {}, message = "Opération réussie.") {
    return res.json({
        success: true,
        message,
        ...data
    });
}

function failure(
    res,
    status = 400,
    message = "Une erreur est survenue.",
    extra = {}
) {
    return res.status(status).json({
        success: false,
        message,
        ...extra
    });
}

// ============================================================
// MOTS DE PASSE
// ============================================================

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");

    const hash = crypto
        .scryptSync(String(password), salt, 64)
        .toString("hex");

    return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
    if (!storedPassword) {
        return false;
    }

    const stored = String(storedPassword);

    // Compatibilité avec d'anciens comptes
    if (!stored.startsWith("scrypt:")) {
        return String(password) === stored;
    }

    const parts = stored.split(":");

    if (parts.length !== 3) {
        return false;
    }

    const salt = parts[1];
    const hashHex = parts[2];

    try {
        const derived = crypto.scryptSync(
            String(password),
            salt,
            64
        );

        const storedHash = Buffer.from(hashHex, "hex");

        if (derived.length !== storedHash.length) {
            return false;
        }

        return crypto.timingSafeEqual(
            derived,
            storedHash
        );
    } catch (error) {
        console.error(
            "Erreur vérification mot de passe:",
            error.message
        );

        return false;
    }
}

// ============================================================
// PREMIUM
// ============================================================

function isPremiumUser(user) {
    if (!user) {
        return false;
    }

    if (
        user.premium === true ||
        user.is_premium === true
    ) {
        return true;
    }

    if (user.premium_until) {
        return new Date(user.premium_until) > new Date();
    }

    return false;
}

function isBlockedUser(user) {
    if (!user) {
        return false;
    }

    return (
        user.blocked === true ||
        user.is_blocked === true
    );
}

// ============================================================
// TOKEN ADMIN
// ============================================================

function createAdminToken(email) {
    const timestamp = Date.now();

    const payload = `${normalizeEmail(email)}.${timestamp}`;

    const signature = crypto
        .createHmac(
            "sha256",
            ADMIN_SECRET
        )
        .update(payload)
        .digest("hex");

    return Buffer.from(
        `${payload}.${signature}`
    ).toString("base64url");
}

function verifyAdminToken(token) {
    if (!token) {
        return false;
    }

    try {
        const decoded = Buffer
            .from(token, "base64url")
            .toString("utf8");

        const parts = decoded.split(".");

        if (parts.length !== 3) {
            return false;
        }

        const email = parts[0];
        const timestamp = Number(parts[1]);
        const signature = parts[2];

        if (!email || !timestamp || !signature) {
            return false;
        }

        // Token valable 24 heures
        if (
            Date.now() - timestamp >
            24 * 60 * 60 * 1000
        ) {
            return false;
        }

        const payload =
            `${email}.${timestamp}`;

        const expected = crypto
            .createHmac(
                "sha256",
                ADMIN_SECRET
            )
            .update(payload)
            .digest("hex");

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expected)
        );
    } catch (error) {
        return false;
    }
}

// ============================================================
// AUTH ADMIN
// ============================================================

function adminAuth(req, res, next) {
    let token = null;

    const auth =
        req.headers.authorization;

    if (
        auth &&
        auth.startsWith("Bearer ")
    ) {
        token = auth.substring(7);
    }

    if (!token) {
        token =
            req.headers["x-admin-token"];
    }

    if (!token) {
        token =
            req.query.token;
    }

    if (!verifyAdminToken(token)) {
        return failure(
            res,
            401,
            "Accès administrateur refusé."
        );
    }

    next();
}

// ============================================================
// LOG ADMIN
// ============================================================

async function logActivity(
    a,
    b,
    c,
    d
) {
    try {
        let req = null;
        let action;
        let details;
        let userId = null;

        if (
            a &&
            a.method &&
            a.headers
        ) {
            req = a;
            action = b;
            details = c;
            userId =
                d !== undefined
                    ? d
                    : null;
        } else {
            action = a;
            details = b;
            userId =
                c !== undefined
                    ? c
                    : null;
        }

        let ip = null;

        if (req) {
            ip =
                req.headers["x-forwarded-for"] ||
                req.socket?.remoteAddress ||
                null;
        }

        await pool.query(
            `
            INSERT INTO admin_activity
            (
                action,
                details,
                user_id,
                ip
            )
            VALUES ($1, $2, $3, $4)
            `,
            [
                cleanString(action),
                typeof details === "string"
                    ? details
                    : JSON.stringify(details || {}),
                userId,
                ip
            ]
        );
    } catch (error) {
        console.error(
            "Erreur log activité:",
            error.message
        );
    }
}

// ============================================================
// BASE DE DONNÉES
// ============================================================

async function initDatabase() {
    console.log(
        "🔄 Initialisation PostgreSQL..."
    );

    // --------------------------------------------------------
    // USERS
    // --------------------------------------------------------

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            nom TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            telephone TEXT,
            domaine TEXT,
            password TEXT NOT NULL,
            photo TEXT,

            role VARCHAR(20) NOT NULL DEFAULT 'user',

            premium BOOLEAN DEFAULT FALSE,
            is_premium BOOLEAN DEFAULT FALSE,

            premium_until TIMESTAMPTZ,

            blocked BOOLEAN DEFAULT FALSE,
            is_blocked BOOLEAN DEFAULT FALSE,

            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    // Compatibilité anciennes bases
    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS role VARCHAR(20)
        DEFAULT 'user'
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS premium BOOLEAN
        DEFAULT FALSE
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_premium BOOLEAN
        DEFAULT FALSE
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS blocked BOOLEAN
        DEFAULT FALSE
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN
        DEFAULT FALSE
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_email
        ON users(email)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_premium
        ON users(premium)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_blocked
        ON users(blocked)
    `);

    // --------------------------------------------------------
    // PAIEMENTS
    // --------------------------------------------------------

    await pool.query(`
        CREATE TABLE IF NOT EXISTS paiements (
            id SERIAL PRIMARY KEY,

            user_id INTEGER,

            nom TEXT,
            email TEXT,
            telephone TEXT,

            amount NUMERIC(12,2),
            montant NUMERIC(12,2),

            currency VARCHAR(10) DEFAULT 'USD',

            methode TEXT,

            proof TEXT,
            proof_url TEXT,
            proof_type TEXT,

            recipient_number TEXT,
            recipient_name TEXT,

            status VARCHAR(30)
                DEFAULT 'pending',

            premium_days INTEGER
                DEFAULT 30,

            notes TEXT,

            validated_at TIMESTAMPTZ,
            refused_at TIMESTAMPTZ,
            refusal_reason TEXT,

            created_at TIMESTAMPTZ
                DEFAULT NOW(),

            updated_at TIMESTAMPTZ
                DEFAULT NOW()
        )
    `);

    // --------------------------------------------------------
    // DEMANDES PAIEMENT
    // --------------------------------------------------------

    await pool.query(`
        CREATE TABLE IF NOT EXISTS demandes_paiement (
            id SERIAL PRIMARY KEY,

            user_id INTEGER NOT NULL,

            telephone_paiement TEXT,
            reference_paiement TEXT,

            amount NUMERIC(12,2),
            montant NUMERIC(12,2),

            currency VARCHAR(10)
                DEFAULT 'USD',

            methode TEXT,

            proof TEXT,

            recipient_number TEXT,
            recipient_name TEXT,

            status VARCHAR(30)
                DEFAULT 'pending',

            premium_days INTEGER
                DEFAULT 30,

            notes TEXT,

            validated_at TIMESTAMPTZ,
            refused_at TIMESTAMPTZ,
            refusal_reason TEXT,

            created_at TIMESTAMPTZ
                DEFAULT NOW(),

            updated_at TIMESTAMPTZ
                DEFAULT NOW()
        )
    `);

    // --------------------------------------------------------
    // ACTIVITÉS ADMIN
    // --------------------------------------------------------

    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_activity (
            id SERIAL PRIMARY KEY,

            action TEXT NOT NULL,
            details TEXT,

            user_id INTEGER,

            ip TEXT,

            created_at TIMESTAMPTZ
                DEFAULT NOW()
        )
    `);

    // --------------------------------------------------------
    // MESSAGES
    // --------------------------------------------------------

    await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,

            sender_type VARCHAR(30)
                DEFAULT 'admin',

            sender_user_id INTEGER,

            sender_name TEXT,
            sender_email TEXT,

            recipient_user_id INTEGER,

            recipient_name TEXT,
            recipient_email TEXT,

            subject TEXT NOT NULL
                DEFAULT 'Message BMJ SERVICE',

            content TEXT NOT NULL,

            type VARCHAR(30) NOT NULL
                DEFAULT 'user',

            priority VARCHAR(20) NOT NULL
                DEFAULT 'normal',

            audience VARCHAR(30) NOT NULL
                DEFAULT 'individual',

            status VARCHAR(30) NOT NULL
                DEFAULT 'unread',

            read_at TIMESTAMPTZ,

            created_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW(),

            updated_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW()
        )
    `);

    // --------------------------------------------------------
    // INDEX PAIEMENTS
    // --------------------------------------------------------

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_paiements_status
        ON paiements(status)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_paiements_user
        ON paiements(user_id)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_paiements_created
        ON paiements(created_at)
    `);

    // --------------------------------------------------------
    // INDEX DEMANDES
    // --------------------------------------------------------

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_demandes_status
        ON demandes_paiement(status)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_demandes_user
        ON demandes_paiement(user_id)
    `);

    // --------------------------------------------------------
    // INDEX MESSAGES
    // --------------------------------------------------------

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_recipient
        ON messages(recipient_user_id)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_status
        ON messages(status)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_created
        ON messages(created_at)
    `);

    // ========================================================
    // CRÉATION AUTOMATIQUE DE MUSSIWA JUSTIN
    // ========================================================

    const existingJustin =
        await pool.query(
            `
            SELECT *
            FROM users
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
            `,
            [JUSTIN_EMAIL]
        );

    if (
        existingJustin.rows.length === 0
    ) {
        const passwordHash =
            hashPassword(
                JUSTIN_PASSWORD
            );

        await pool.query(
            `
            INSERT INTO users
            (
                nom,
                email,
                password,
                domaine,
                role,
                premium,
                is_premium,
                blocked,
                is_blocked
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                'admin',
                TRUE,
                TRUE,
                FALSE,
                FALSE
            )
            `,
            [
                JUSTIN_NAME,
                JUSTIN_EMAIL,
                passwordHash,
                "Administration"
            ]
        );

        console.log(
            "✅ Compte MUSSIWA JUSTIN créé automatiquement."
        );
    } else {
        await pool.query(
            `
            UPDATE users
            SET
                nom = $1,
                role = 'admin',
                blocked = FALSE,
                is_blocked = FALSE,
                updated_at = NOW()
            WHERE LOWER(email) = LOWER($2)
            `,
            [
                JUSTIN_NAME,
                JUSTIN_EMAIL
            ]
        );

        console.log(
            "✅ Compte MUSSIWA JUSTIN déjà présent."
        );
    }

    console.log(
        "✅ Base de données initialisée."
    );
}

// ============================================================
// API PRINCIPALE
// ============================================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        service: "BMJ SERVICE",
        message:
            "Backend BMJ SERVICE fonctionne correctement.",
        version: "1.0.0",
        database: "PostgreSQL"
    });
});

app.get("/api", (req, res) => {
    res.json({
        success: true,
        message:
            "BMJ SERVICE API fonctionne.",
        api: "/api",
        version: "1.0.0"
    });
});

app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.json({
            success: true,
            status: "online",
            database: "connected",
            service: "BMJ SERVICE"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            status: "offline",
            database: "error",
            error: error.message
        });
    }
});

app.get("/api/test-db", async (req, res) => {
    try {
        const result =
            await pool.query(
                "SELECT NOW() AS now"
            );

        res.json({
            success: true,
            message:
                "Connexion PostgreSQL réussie.",
            time: result.rows[0].now
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message:
                "Erreur connexion PostgreSQL.",
            error: error.message
        });
    }
});

// ============================================================
// ROUTES
// ============================================================

app.get("/api/routes", (req, res) => {
    res.json({
        success: true,
        routes: [
            "GET /",
            "GET /api",
            "GET /api/health",
            "GET /api/test-db",

            "POST /api/inscription",
            "POST /api/register",
            "POST /api/signup",

            "POST /api/connexion",
            "POST /api/login",
            "POST /api/signin",

            "POST /api/admin/login",

            "GET /api/utilisateurs",
            "GET /api/apprenants",

            "POST /api/paiements",
            "GET /api/paiements",

            "POST /api/demandes-paiement",
            "GET /api/demandes-paiement",

            "GET /api/messages",

            "GET /api/statistiques",
            "GET /api/admin/statistiques"
        ]
    });
});

// ============================================================
// INSCRIPTION
// ============================================================

async function registerUser(req, res) {
    try {
        const {
            nom,
            name,
            email,
            telephone,
            phone,
            domaine,
            password,
            mot_de_passe,
            photo
        } = req.body;

        const finalName =
            cleanString(nom || name);

        const finalEmail =
            normalizeEmail(email);

        const finalPhone =
            cleanString(
                telephone || phone
            );

        const finalPassword =
            String(
                password ||
                mot_de_passe ||
                ""
            );

        if (!finalName) {
            return failure(
                res,
                400,
                "Le nom est obligatoire."
            );
        }

        if (!finalEmail) {
            return failure(
                res,
                400,
                "L'adresse email est obligatoire."
            );
        }

        if (!finalPassword) {
            return failure(
                res,
                400,
                "Le mot de passe est obligatoire."
            );
        }

        const existing =
            await pool.query(
                `
                SELECT id
                FROM users
                WHERE LOWER(email) = LOWER($1)
                `,
                [finalEmail]
            );

        if (existing.rows.length) {
            return failure(
                res,
                409,
                "Cette adresse email est déjà utilisée."
            );
        }

        const passwordHash =
            hashPassword(
                finalPassword
            );

        const result =
            await pool.query(
                `
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
                    role,
                    premium,
                    is_premium,
                    premium_until,
                    blocked,
                    is_blocked,
                    created_at
                `,
                [
                    finalName,
                    finalEmail,
                    finalPhone,
                    cleanString(domaine),
                    passwordHash,
                    photo || null
                ]
            );

        return success(
            res,
            {
                user: result.rows[0]
            },
            "Inscription réussie."
        );
    } catch (error) {
        console.error(
            "Erreur inscription:",
            error
        );

        return failure(
            res,
            500,
            "Erreur lors de l'inscription.",
            {
                error: error.message
            }
        );
    }
}

app.post(
    "/api/inscription",
    registerUser
);

app.post(
    "/api/register",
    registerUser
);

app.post(
    "/api/signup",
    registerUser
);

// ============================================================
// CONNEXION UTILISATEUR
// ============================================================

async function loginUser(req, res) {
    try {
        const {
            email,
            password,
            mot_de_passe
        } = req.body;

        const finalEmail =
            normalizeEmail(email);

        const finalPassword =
            String(
                password ||
                mot_de_passe ||
                ""
            );

        if (!finalEmail || !finalPassword) {
            return failure(
                res,
                400,
                "Email et mot de passe obligatoires."
            );
        }

        const result =
            await pool.query(
                `
                SELECT *
                FROM users
                WHERE LOWER(email) = LOWER($1)
                LIMIT 1
                `,
                [finalEmail]
            );

        if (!result.rows.length) {
            return failure(
                res,
                401,
                "Email ou mot de passe incorrect."
            );
        }

        const user =
            result.rows[0];

        if (
            !verifyPassword(
                finalPassword,
                user.password
            )
        ) {
            return failure(
                res,
                401,
                "Email ou mot de passe incorrect."
            );
        }

        if (isBlockedUser(user)) {
            return failure(
                res,
                403,
                "Ce compte est bloqué."
            );
        }

        const safeUser = {
            id: user.id,
            nom: user.nom,
            email: user.email,
            telephone: user.telephone,
            domaine: user.domaine,
            photo: user.photo,
            role: user.role,
            premium: isPremiumUser(user),
            is_premium: isPremiumUser(user),
            premium_until: user.premium_until,
            blocked: false,
            is_blocked: false
        };

        return success(
            res,
            {
                user: safeUser
            },
            "Connexion réussie."
        );
    } catch (error) {
        console.error(
            "Erreur connexion:",
            error
        );

        return failure(
            res,
            500,
            "Erreur lors de la connexion.",
            {
                error: error.message
            }
        );
    }
}

app.post(
    "/api/connexion",
    loginUser
);

app.post(
    "/api/login",
    loginUser
);

app.post(
    "/api/signin",
    loginUser
);

// ============================================================
// CONNEXION ADMIN
// ============================================================

app.post(
    "/api/admin/login",
    async (req, res) => {
        try {
            const {
                email,
                password,
                mot_de_passe
            } = req.body;

            const finalEmail =
                normalizeEmail(email);

            const finalPassword =
                String(
                    password ||
                    mot_de_passe ||
                    ""
                );

            if (
                !finalEmail ||
                !finalPassword
            ) {
                return failure(
                    res,
                    400,
                    "Email et mot de passe obligatoires."
                );
            }

            // ------------------------------------------------
            // ADMIN CONFIGURÉ
            // ------------------------------------------------

            if (
                finalEmail ===
                    normalizeEmail(
                        ADMIN_EMAIL
                    ) &&
                finalPassword ===
                    ADMIN_PASSWORD
            ) {
                const token =
                    createAdminToken(
                        finalEmail
                    );

                await logActivity(
                    "ADMIN_LOGIN",
                    {
                        email:
                            finalEmail
                    }
                );

                return success(
                    res,
                    {
                        token,
                        admin: {
                            email:
                                finalEmail,
                            role:
                                "admin"
                        }
                    },
                    "Connexion administrateur réussie."
                );
            }

            // ------------------------------------------------
            // MUSSIWA JUSTIN
            // ------------------------------------------------

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM users
                    WHERE LOWER(email) = LOWER($1)
                    AND role = 'admin'
                    LIMIT 1
                    `,
                    [finalEmail]
                );

            if (!result.rows.length) {
                return failure(
                    res,
                    401,
                    "Identifiants administrateur incorrects."
                );
            }

            const user =
                result.rows[0];

            if (
                !verifyPassword(
                    finalPassword,
                    user.password
                )
            ) {
                return failure(
                    res,
                    401,
                    "Identifiants administrateur incorrects."
                );
            }

            const token =
                createAdminToken(
                    user.email
                );

            await logActivity(
                "ADMIN_LOGIN",
                {
                    email:
                        user.email,
                    user_id:
                        user.id
                },
                user.id
            );

            return success(
                res,
                {
                    token,
                    admin: {
                        id: user.id,
                        nom: user.nom,
                        email: user.email,
                        role: "admin"
                    }
                },
                "Connexion administrateur réussie."
            );
        } catch (error) {
            console.error(
                "Erreur admin login:",
                error
            );

            return failure(
                res,
                500,
                "Erreur connexion administrateur.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// UTILISATEUR PAR ID
// ============================================================

app.get(
    "/api/utilisateurs/:id",
    async (req, res) => {
        try {
            const id =
                parseId(
                    req.params.id
                );

            if (!id) {
                return failure(
                    res,
                    400,
                    "ID utilisateur invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        nom,
                        email,
                        telephone,
                        domaine,
                        photo,
                        role,
                        premium,
                        is_premium,
                        premium_until,
                        blocked,
                        is_blocked,
                        created_at,
                        updated_at
                    FROM users
                    WHERE id = $1
                    `,
                    [id]
                );

            if (!result.rows.length) {
                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            const user =
                result.rows[0];

            user.premium =
                isPremiumUser(user);

            user.is_premium =
                user.premium;

            return success(
                res,
                {
                    user
                }
            );
        } catch (error) {
            return failure(
                res,
                500,
                "Erreur récupération utilisateur.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// LISTE UTILISATEURS ADMIN
// ============================================================

async function getUsers(req, res) {
    try {
        const result =
            await pool.query(
                `
                SELECT
                    id,
                    nom,
                    email,
                    telephone,
                    domaine,
                    photo,
                    role,
                    premium,
                    is_premium,
                    premium_until,
                    blocked,
                    is_blocked,
                    created_at,
                    updated_at
                FROM users
                ORDER BY id DESC
                `
            );

        const users =
            result.rows.map(
                user => ({
                    ...user,
                    premium:
                        isPremiumUser(user),
                    is_premium:
                        isPremiumUser(user)
                })
            );

        return success(
            res,
            {
                utilisateurs: users,
                users,
                apprenants: users,
                total: users.length
            }
        );
    } catch (error) {
        return failure(
            res,
            500,
            "Erreur récupération utilisateurs.",
            {
                error:
                    error.message
            }
        );
    }
}

app.get(
    "/api/utilisateurs",
    adminAuth,
    getUsers
);

app.get(
    "/api/admin/utilisateurs",
    adminAuth,
    getUsers
);

app.get(
    "/api/apprenants",
    adminAuth,
    getUsers
);

// Compatibilité ancienne route
app.get(
    "/api/apprenant",
    adminAuth,
    getUsers
);

// ============================================================
// PAIEMENTS — CREATION
// ============================================================

async function createPayment(req, res) {
    try {
        const {
            user_id,
            nom,
            email,
            telephone,
            amount,
            montant,
            currency,
            methode,
            proof,
            proof_url,
            proof_type,
            recipient_number,
            recipient_name,
            premium_days,
            notes
        } = req.body;

        const userId =
            user_id
                ? parseId(user_id)
                : null;

        const finalAmount =
            Number(
                amount !== undefined
                    ? amount
                    : montant
            );

        if (
            !Number.isFinite(
                finalAmount
            ) ||
            finalAmount <= 0
        ) {
            return failure(
                res,
                400,
                "Montant de paiement invalide."
            );
        }

        const result =
            await pool.query(
                `
                INSERT INTO paiements
                (
                    user_id,
                    nom,
                    email,
                    telephone,
                    amount,
                    montant,
                    currency,
                    methode,
                    proof,
                    proof_url,
                    proof_type,
                    recipient_number,
                    recipient_name,
                    status,
                    premium_days,
                    notes
                )
                VALUES
                (
                    $1,$2,$3,$4,$5,$5,
                    $6,$7,$8,$9,$10,
                    $11,$12,'pending',$13,$14
                )
                RETURNING *
                `,
                [
                    userId,
                    cleanString(nom),
                    normalizeEmail(email),
                    cleanString(telephone),
                    finalAmount,
                    cleanString(
                        currency || "USD"
                    ),
                    cleanString(methode),
                    proof || null,
                    proof_url || null,
                    proof_type || null,
                    cleanString(
                        recipient_number
                    ),
                    cleanString(
                        recipient_name
                    ),
                    Number(
                        premium_days || 30
                    ),
                    cleanString(notes)
                ]
            );

        return success(
            res,
            {
                paiement:
                    result.rows[0]
            },
            "Paiement envoyé. Il sera vérifié par l'administration."
        );
    } catch (error) {
        console.error(
            "Erreur paiement:",
            error
        );

        return failure(
            res,
            500,
            "Erreur lors de l'enregistrement du paiement.",
            {
                error:
                    error.message
            }
        );
    }
}

app.post(
    "/api/paiements",
    createPayment
);

app.post(
    "/api/paiements/manual",
    createPayment
);

// ============================================================
// LISTE PAIEMENTS ADMIN
// ============================================================

async function getPayments(req, res) {
    try {
        const result =
            await pool.query(
                `
                SELECT
                    p.*,
                    u.nom AS user_nom,
                    u.email AS user_email,
                    u.telephone AS user_telephone,
                    u.domaine AS user_domaine
                FROM paiements p
                LEFT JOIN users u
                    ON u.id = p.user_id
                ORDER BY p.id DESC
                `
            );

        return success(
            res,
            {
                paiements:
                    result.rows,
                payments:
                    result.rows,
                total:
                    result.rows.length
            }
        );
    } catch (error) {
        return failure(
            res,
            500,
            "Erreur récupération paiements.",
            {
                error:
                    error.message
            }
        );
    }
}

app.get(
    "/api/paiements",
    adminAuth,
    getPayments
);

app.get(
    "/api/admin/paiements",
    adminAuth,
    getPayments
);

// ============================================================
// PAIEMENT PAR ID
// ============================================================

app.get(
    "/api/paiements/:id",
    adminAuth,
    async (req, res) => {
        try {
            const id =
                parseId(
                    req.params.id
                );

            if (!id) {
                return failure(
                    res,
                    400,
                    "ID paiement invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    SELECT
                        p.*,
                        u.nom AS user_nom,
                        u.email AS user_email,
                        u.telephone AS user_telephone,
                        u.domaine AS user_domaine
                    FROM paiements p
                    LEFT JOIN users u
                        ON u.id = p.user_id
                    WHERE p.id = $1
                    `,
                    [id]
                );

            if (!result.rows.length) {
                return failure(
                    res,
                    404,
                    "Paiement introuvable."
                );
            }

            return success(
                res,
                {
                    paiement:
                        result.rows[0]
                }
            );
        } catch (error) {
            return failure(
                res,
                500,
                "Erreur récupération paiement.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// VALIDATION PAIEMENT
// ============================================================

app.patch(
    "/api/paiements/:id/valider",
    adminAuth,
    async (req, res) => {
        const client =
            await pool.connect();

        try {
            const id =
                parseId(
                    req.params.id
                );

            if (!id) {
                return failure(
                    res,
                    400,
                    "ID paiement invalide."
                );
            }

            await client.query(
                "BEGIN"
            );

            const payment =
                await client.query(
                    `
                    SELECT *
                    FROM paiements
                    WHERE id = $1
                    FOR UPDATE
                    `,
                    [id]
                );

            if (!payment.rows.length) {
                await client.query(
                    "ROLLBACK"
                );

                return failure(
                    res,
                    404,
                    "Paiement introuvable."
                );
            }

            const paiement =
                payment.rows[0];

            if (
                paiement.status ===
                "validated"
            ) {
                await client.query(
                    "ROLLBACK"
                );

                return failure(
                    res,
                    409,
                    "Ce paiement est déjà validé."
                );
            }

            if (
                paiement.status ===
                "refused"
            ) {
                await client.query(
                    "ROLLBACK"
                );

                return failure(
                    res,
                    409,
                    "Ce paiement a déjà été refusé."
                );
            }

            const userId =
                paiement.user_id;

            if (!userId) {
                await client.query(
                    "ROLLBACK"
                );

                return failure(
                    res,
                    400,
                    "Ce paiement n'est associé à aucun utilisateur."
                );
            }

            const user =
                await client.query(
                    `
                    SELECT *
                    FROM users
                    WHERE id = $1
                    FOR UPDATE
                    `,
                    [userId]
                );

            if (!user.rows.length) {
                await client.query(
                    "ROLLBACK"
                );

                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            const days =
                Number(
                    paiement.premium_days ||
                    30
                );

            const now =
                new Date();

            let baseDate =
                now;

            if (
                user.rows[0]
                    .premium_until &&
                new Date(
                    user.rows[0]
                        .premium_until
                ) > now
            ) {
                baseDate =
                    new Date(
                        user.rows[0]
                            .premium_until
                    );
            }

            const premiumUntil =
                new Date(
                    baseDate.getTime() +
                    days *
                        24 *
                        60 *
                        60 *
                        1000
                );

            await client.query(
                `
                UPDATE users
                SET
                    premium = TRUE,
                    is_premium = TRUE,
                    premium_until = $1,
                    updated_at = NOW()
                WHERE id = $2
                `,
                [
                    premiumUntil,
                    userId
                ]
            );

            const updated =
                await client.query(
                    `
                    UPDATE paiements
                    SET
                        status = 'validated',
                        validated_at = NOW(),
                        updated_at = NOW()
                    WHERE id = $1
                    RETURNING *
                    `,
                    [id]
                );

            await client.query(
                "COMMIT"
            );

            await logActivity(
                "VALIDATE_PAYMENT",
                {
                    paiement_id: id,
                    user_id: userId,
                    premium_days: days
                },
                userId
            );

            return success(
                res,
                {
                    paiement:
                        updated.rows[0],
                    user_id: userId,
                    premium: true,
                    is_premium: true,
                    premium_until:
                        premiumUntil,
                    premium_days:
                        days
                },
                "Paiement validé. Premium activé."
            );
        } catch (error) {
            try {
                await client.query(
                    "ROLLBACK"
                );
            } catch (_) {}

            console.error(
                "Erreur validation paiement:",
                error
            );

            return failure(
                res,
                500,
                "Erreur validation paiement.",
                {
                    error:
                        error.message
                }
            );
        } finally {
            client.release();
        }
    }
);

// ============================================================
// REFUS PAIEMENT
// ============================================================

app.patch(
    "/api/paiements/:id/refuser",
    adminAuth,
    async (req, res) => {
        try {
            const id =
                parseId(
                    req.params.id
                );

            const reason =
                cleanString(
                    req.body.reason ||
                    req.body.motif ||
                    req.body.refusal_reason ||
                    "Paiement refusé."
                );

            if (!id) {
                return failure(
                    res,
                    400,
                    "ID paiement invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    UPDATE paiements
                    SET
                        status = 'refused',
                        refused_at = NOW(),
                        refusal_reason = $1,
                        updated_at = NOW()
                    WHERE id = $2
                    AND status <> 'validated'
                    RETURNING *
                    `,
                    [reason, id]
                );

            if (!result.rows.length) {
                const check =
                    await pool.query(
                        `
                        SELECT status
                        FROM paiements
                        WHERE id = $1
                        `,
                        [id]
                    );

                if (!check.rows.length) {
                    return failure(
                        res,
                        404,
                        "Paiement introuvable."
                    );
                }

                return failure(
                    res,
                    409,
                    "Impossible de refuser ce paiement."
                );
            }

            await logActivity(
                "REFUSE_PAYMENT",
                {
                    paiement_id: id,
                    reason
                }
            );

            return success(
                res,
                {
                    paiement:
                        result.rows[0]
                },
                "Paiement refusé."
            );
        } catch (error) {
            return failure(
                res,
                500,
                "Erreur refus paiement.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// ACTIVATION PREMIUM MANUELLE
// ============================================================

app.patch(
    "/api/admin/users/:id/premium",
    adminAuth,
    async (req, res) => {
        try {
            const id =
                parseId(
                    req.params.id
                );

            if (!id) {
                return failure(
                    res,
                    400,
                    "ID utilisateur invalide."
                );
            }

            const body =
                req.body || {};

            const hasEnabled =
                body.enabled !== undefined ||
                body.premium !== undefined ||
                body.is_premium !== undefined;

            let enabled = true;

            if (hasEnabled) {
                const value =
                    body.enabled ??
                    body.premium ??
                    body.is_premium;

                enabled =
                    value === true ||
                    value === 1 ||
                    value === "1" ||
                    value === "true";
            }

            const days =
                Number(
                    body.days ||
                    body.premium_days ||
                    30
                );

            if (
                !Number.isInteger(days) ||
                days <= 0 ||
                days > 3650
            ) {
                return failure(
                    res,
                    400,
                    "Durée premium invalide."
                );
            }

            const userResult =
                await pool.query(
                    `
                    SELECT *
                    FROM users
                    WHERE id = $1
                    `,
                    [id]
                );

            if (!userResult.rows.length) {
                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            if (!enabled) {
                const result =
                    await pool.query(
                        `
                        UPDATE users
                        SET
                            premium = FALSE,
                            is_premium = FALSE,
                            premium_until = NULL,
                            updated_at = NOW()
                        WHERE id = $1
                        RETURNING *
                        `,
                        [id]
                    );

                await logActivity(
                    "DISABLE_PREMIUM",
                    {
                        user_id: id
                    },
                    id
                );

                return success(
                    res,
                    {
                        user:
                            result.rows[0]
                    },
                    "Premium désactivé."
                );
            }

            const user =
                userResult.rows[0];

            const now =
                new Date();

            let baseDate =
                now;

            if (
                user.premium_until &&
                new Date(
                    user.premium_until
                ) > now
            ) {
                baseDate =
                    new Date(
                        user.premium_until
                    );
            }

            const premiumUntil =
                new Date(
                    baseDate.getTime() +
                    days *
                        24 *
                        60 *
                        60 *
                        1000
                );

            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        premium = TRUE,
                        is_premium = TRUE,
                        premium_until = $1,
                        updated_at = NOW()
                    WHERE id = $2
                    RETURNING *
                    `,
                    [
                        premiumUntil,
                        id
                    ]
                );

            await logActivity(
                "ENABLE_PREMIUM",
                {
                    user_id: id,
                    days
                },
                id
            );

            return success(
                res,
                {
                    user:
                        result.rows[0],
                    premium: true,
                    is_premium: true,
                    premium_until:
                        premiumUntil
                },
                "Premium activé."
            );
        } catch (error) {
            return failure(
                res,
                500,
                "Erreur activation premium.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// BLOCAGE UTILISATEUR
// ============================================================

app.patch(
    "/api/admin/users/:id/block",
    adminAuth,
    async (req, res) => {
        try {
            const id =
                parseId(
                    req.params.id
                );

            const blocked =
                req.body.blocked === true ||
                req.body.blocked === 1 ||
                req.body.blocked === "1" ||
                req.body.blocked === "true";

            if (!id) {
                return failure(
                    res,
                    400,
                    "ID utilisateur invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        blocked = $1,
                        is_blocked = $1,
                        updated_at = NOW()
                    WHERE id = $2
                    RETURNING
                        id,
                        nom,
                        email,
                        blocked,
                        is_blocked
                    `,
                    [
                        blocked,
                        id
                    ]
                );

            if (!result.rows.length) {
                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            await logActivity(
                blocked
                    ? "BLOCK_USER"
                    : "UNBLOCK_USER",
                {
                    user_id: id
                },
                id
            );

            return success(
                res,
                {
                    user:
                        result.rows[0]
                },
                blocked
                    ? "Utilisateur bloqué."
                    : "Utilisateur débloqué."
            );
        } catch (error) {
            return failure(
                res,
                500,
                "Erreur blocage utilisateur.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

app.patch(
    "/api/admin/utilisateurs/:id/blocage",
    adminAuth,
    async (req, res, next) => {
        req.url =
            `/api/admin/users/${req.params.id}/block`;

        next();
    }
);

// ============================================================
// DEMANDES DE PAIEMENT
// ============================================================

app.post(
    "/api/demandes-paiement",
    async (req, res) => {
        try {
            const {
                user_id,
                telephone_paiement,
                reference_paiement,
                amount,
                montant,
                currency,
                methode,
                proof,
                recipient_number,
                recipient_name,
                premium_days,
                notes
            } = req.body;

            const userId =
                parseId(user_id);

            if (!userId) {
                return failure(
                    res,
                    400,
                    "Utilisateur invalide."
                );
            }

            const finalAmount =
                Number(
                    amount ??
                    montant
                );

            if (
                !Number.isFinite(
                    finalAmount
                ) ||
                finalAmount <= 0
            ) {
                return failure(
                    res,
                    400,
                    "Montant invalide."
                );
            }

            const user =
                await pool.query(
                    `
                    SELECT id
                    FROM users
                    WHERE id = $1
                    `,
                    [userId]
                );

            if (!user.rows.length) {
                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            const result =
                await pool.query(
                    `
                    INSERT INTO demandes_paiement
                    (
                        user_id,
                        telephone_paiement,
                        reference_paiement,
                        amount,
                        montant,
                        currency,
                        methode,
                        proof,
                        recipient_number,
                        recipient_name,
                        premium_days,
                        notes
                    )
                    VALUES
                    (
                        $1,$2,$3,$4,$4,$5,
                        $6,$7,$8,$9,$10,$11
                    )
                    RETURNING *
                    `,
                    [
                        userId,
                        cleanString(
                            telephone_paiement
                        ),
                        cleanString(
                            reference_paiement
                        ),
                        finalAmount,
                        cleanString(
                            currency || "USD"
                        ),
                        cleanString(methode),
                        proof || null,
                        cleanString(
                            recipient_number
                        ),
                        cleanString(
                            recipient_name
                        ),
                        Number(
                            premium_days || 30
                        ),
                        cleanString(notes)
                    ]
                );

            return success(
                res,
                {
                    demande:
                        result.rows[0]
                },
                "Demande de paiement enregistrée."
            );
        } catch (error) {
            return failure(
                res,
                500,
                "Erreur demande paiement.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// LISTE DEMANDES PAIEMENT
// ============================================================

app.get(
    "/api/demandes-paiement",
    adminAuth,
    async (req, res) => {
        try {
            const result =
                await pool.query(
                    `
                    SELECT
                        d.*,
                        u.nom AS user_nom,
                        u.email AS user_email,
                        u.telephone AS user_telephone,
                        u.domaine AS user_domaine,
                        u.premium AS user_premium,
                        u.is_premium AS user_is_premium,
                        u.premium_until AS user_premium_until
                    FROM demandes_paiement d
                    LEFT JOIN users u
                        ON u.id = d.user_id
                    ORDER BY d.id DESC
                    `
                );

            return success(
                res,
                {
                    demandes:
                        result.rows,
                    total:
                        result.rows.length
                }
            );
        } catch (error) {
            return failure(
                res,
                500,
                "Erreur récupération demandes.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

app.get(
    "/api/admin/demandes-paiement",
    adminAuth,
    async (req, res) => {
        req.url =
            "/api/demandes-paiement";

        return failure(
            res,
            404,
            "Utilisez /api/demandes-paiement."
        );
    }
);

// ============================================================
// STATISTIQUES
// ============================================================

app.get(
    "/api/admin/statistiques",
    adminAuth,
    async (req, res) => {
        try {
            const users =
                await pool.query(
                    `
                    SELECT COUNT(*)::int AS total
                    FROM users
                    `
                );

            const premium =
                await pool.query(
                    `
                    SELECT COUNT(*)::int AS total
                    FROM users
                    WHERE premium = TRUE
                    OR is_premium = TRUE
                    OR (
                        premium_until IS NOT NULL
                        AND premium_until > NOW()
                    )
                    `
                );

            const blocked =
                await pool.query(
                    `
                    SELECT COUNT(*)::int AS total
                    FROM users
                    WHERE blocked = TRUE
                    OR is_blocked = TRUE
                    `
                );

            const payments =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::int AS total,
                        COUNT(*) FILTER
                        (
                            WHERE status = 'pending'
                        )::int AS pending,
                        COUNT(*) FILTER
                        (
                            WHERE status = 'validated'
                        )::int AS validated,
                        COUNT(*) FILTER
                        (
                            WHERE status = 'refused'
                        )::int AS refused,

                        COALESCE(
                            SUM(amount)
                            FILTER
                            (
                                WHERE status = 'validated'
                            ),
                            0
                        )::numeric AS revenues
                    FROM paiements
                    `
                );

            const demandes =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::int AS total,

                        COUNT(*) FILTER
                        (
                            WHERE status = 'pending'
                        )::int AS pending,

                        COUNT(*) FILTER
                        (
                            WHERE status = 'validated'
                        )::int AS validated,

                        COUNT(*) FILTER
                        (
                            WHERE status = 'refused'
                        )::int AS refused
                    FROM demandes_paiement
                    `
                );

            return success(
                res,
                {
                    statistiques: {
                        utilisateurs:
                            users.rows[0].total,

                        premium:
                            premium.rows[0].total,

                        bloques:
                            blocked.rows[0].total,

                        paiements:
                            payments.rows[0],

                        demandes:
                            demandes.rows[0]
                    }
                }
            );
        } catch (error) {
            return failure(
                res,
                500,
                "Erreur statistiques.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

app.get(
    "/api/statistiques",
    async (req, res) => {
        try {
            const users =
                await pool.query(
                    `
                    SELECT COUNT(*)::int AS total
                    FROM users
                    `
                );

            const premium =
                await pool.query(
                    `
                    SELECT COUNT(*)::int AS total
                    FROM users
                    WHERE premium = TRUE
                    OR is_premium = TRUE
                    OR (
                        premium_until IS NOT NULL
                        AND premium_until > NOW()
                    )
                    `
                );

            return success(
                res,
                {
                    utilisateurs:
                        users.rows[0].total,

                    premium:
                        premium.rows[0].total
                }
            );
        } catch (error) {
            return failure(
                res,
                500,
                "Erreur statistiques.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// MESSAGES
// ============================================================

const MESSAGE_TYPES = {
    USER: "user",
    OFFICIAL: "official",
    USER_REPLY: "user_reply"
};

const MESSAGE_PRIORITIES = {
    NORMAL: "normal",
    IMPORTANT: "important",
    URGENT: "urgent"
};

const MESSAGE_AUDIENCES = {
    ALL: "all",
    STANDARD: "standard",
    PREMIUM: "premium",
    INDIVIDUAL: "individual",
    ADMIN: "admin"
};

function normalizePriority(value) {
    const v =
        cleanString(value)
            .toLowerCase();

    if (
        v === "urgent" ||
        v === "important"
    ) {
        return v;
    }

    return "normal";
}

function normalizeAudience(value) {
    const v =
        cleanString(value)
            .toLowerCase();

    if (
        Object.values(
            MESSAGE_AUDIENCES
        ).includes(v)
    ) {
        return v;
    }

    return "individual";
}

function normalizeMessageType(value) {
    const v =
        cleanString(value)
            .toLowerCase();

    if (
        v === "official"
    ) {
        return "official";
    }

    if (
        v === "user_reply"
    ) {
        return "user_reply";
    }

    return "user";
}

// ============================================================
// ENVOI MESSAGE ADMIN -> UTILISATEUR
// ============================================================

app.post(
    "/api/messages/send-user",
    adminAuth,
    async (req, res) => {
        try {
            const {
                user_id,
                subject,
                content,
                priority
            } = req.body;

            const userId =
                parseId(user_id);

            if (!userId) {
                return failure(
                    res,
                    400,
                    "Utilisateur invalide."
                );
            }

            if (!cleanString(content)) {
                return failure(
                    res,
                    400,
                    "Le message est obligatoire."
                );
            }

            const user =
                await pool.query(
                    `
                    SELECT *
                    FROM users
                    WHERE id = $1
                    `,
                    [userId]
                );

            if (!user.rows.length) {
                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            const u =
                user.rows[0];

            const result =
                await pool.query(
                    `
                    INSERT INTO messages
                    (
                        sender_type,
                        sender_name,
                        sender_email,
                        recipient_user_id,
                        recipient_name,
                        recipient_email,
                        subject,
                        content,
                        type,
                        priority,
                        audience,
                        status
                    )
                    VALUES
                    (
                        'admin',
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        'official',
                        $8,
                        'individual',
                        'unread'
                    )
                    RETURNING *
                    `,
                    [
                        "BMJ SERVICE",
                        ADMIN_EMAIL,
                        userId,
                        u.nom,
                        u.email,
                        cleanString(
                            subject ||
                            "Message BMJ SERVICE"
                        ),
                        cleanString(content),
                        normalizePriority(
                            priority
                        )
                    ]
                );

            return success(
                res,
                {
                    message:
                        result.rows[0]
                },
                "Message envoyé."
            );
        } catch (error) {
            return failure(
                res,
                500,
                "Erreur envoi message.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

app.post(
    "/api/messages/user",
    adminAuth,
    async (req, res) => {
        req.url =
            "/api/messages/send-user";

        return failure(
            res,
            404,
            "Utilisez /api/messages/send-user."
        );
    }
);

// ============================================================
// MESSAGES D'UN UTILISATEUR
// ============================================================

app.get(
    "/api/utilisateurs/:id/messages",
    async (req, res) => {
        try {
            const userId =
                parseId(
                    req.params.id
                );

            if (!userId) {
                return failure(
                    res,
                    400,
                    "ID utilisateur invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM messages
                    WHERE recipient_user_id = $1
                    OR sender_user_id = $1
                    ORDER BY created_at DESC
                    `,
                    [userId]
                );

            return success(
                res,
                {
                    messages:
                        result.rows,
                    total:
                        result.rows.length
                }
            );
        } catch (error) {
            return failure(
                res,
                500,
                "Erreur récupération messages.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// MARQUER MESSAGE LU
// ============================================================

app.patch(
    "/api/utilisateurs/:userId/messages/:messageId/read",
    async (req, res) => {
        try {
            const userId =
                parseId(
                    req.params.userId
                );

            const messageId =
                parseId(
                    req.params.messageId
                );

            if (!userId || !messageId) {
                return failure(
                    res,
                    400,
                    "ID invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    UPDATE messages
                    SET
                        status = 'read',
                        read_at = NOW(),
                        updated_at = NOW()
                    WHERE id = $1
                    AND recipient_user_id = $2
                    RETURNING *
                    `,
                    [
                        messageId,
                        userId
                    ]
                );

            if (!result.rows.length) {
                return failure(
                    res,
                    404,
                    "Message introuvable."
                );
            }

            return success(
                res,
                {
                    message:
                        result.rows[0]
                },
                "Message marqué comme lu."
            );
        } catch (error) {
            return failure(
                res,
                500,
                "Erreur lecture message.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// MESSAGES ADMIN
// ============================================================

app.get(
    "/api/messages",
    adminAuth,
    async (req, res) => {
        try {
            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM messages
                    ORDER BY created_at DESC
                    `
                );

            return success(
                res,
                {
                    messages:
                        result.rows,
                    total:
                        result.rows.length
                }
            );
        } catch (error) {
            return failure(
                res,
                500,
                "Erreur récupération messages.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// ROUTE 404
// ============================================================

app.use(
    (req, res) => {
        res.status(404).json({
            success: false,
            message:
                "Route introuvable.",
            method:
                req.method,
            path:
                req.originalUrl
        });
    }
);

// ============================================================
// GESTIONNAIRE ERREURS
// ============================================================

app.use(
    (
        error,
        req,
        res,
        next
    ) => {
        console.error(
            "Erreur serveur:",
            error
        );

        if (res.headersSent) {
            return next(error);
        }

        res.status(500).json({
            success: false,
            message:
                "Erreur interne du serveur.",
            error:
                error.message
        });
    }
);

// ============================================================
// ARRÊT PROPRE
// ============================================================

async function shutdown(signal) {
    console.log(
        `\n🛑 Signal ${signal} reçu.`
    );

    try {
        await pool.end();

        console.log(
            "✅ Connexion PostgreSQL fermée."
        );

        process.exit(0);
    } catch (error) {
        console.error(
            "Erreur fermeture:",
            error
        );

        process.exit(1);
    }
}

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);

// ============================================================
// DÉMARRAGE
// ============================================================

async function startServer() {
    try {
        if (!DATABASE_URL) {
            throw new Error(
                "DATABASE_URL est absente."
            );
        }

        await initDatabase();

        app.listen(
            PORT,
            "0.0.0.0",
            () => {
                console.log("");
                console.log(
                    "=========================================="
                );
                console.log(
                    "       BMJ SERVICE BACKEND"
                );
                console.log(
                    "=========================================="
                );
                console.log(
                    `🚀 Serveur : http://0.0.0.0:${PORT}`
                );
                console.log(
                    "🗄️ PostgreSQL : CONNECTÉ"
                );
                console.log(
                    "☁️ Render : PRÊT"
                );
                console.log(
                    `👤 Justin : ${JUSTIN_EMAIL}`
                );
                console.log(
                    "👑 Rôle Justin : ADMIN"
                );
                console.log(
                    "=========================================="
                );
                console.log("");
            }
        );
    } catch (error) {
        console.error("");
        console.error(
            "❌ IMPOSSIBLE DE DÉMARRER BMJ SERVICE"
        );
        console.error(
            error
        );
        console.error("");

        process.exit(1);
    }
}

startServer();