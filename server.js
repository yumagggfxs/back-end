// ============================================================
// BMJ SERVICE — SERVER.JS COMPLET
// ============================================================

"use strict";

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const crypto = require("crypto");

// ============================================================
// CONFIGURATION
// ============================================================

const app = express();

const PORT = Number(process.env.PORT) || 10000;

const DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://name_bmj_db_user:TjgoLRbYV0LizRgBFD1nepGqSqErgBgD@dpg-dagn0e15efls73b8rjh0-a/name_bmj_db";

const ADMIN_EMAIL =
    process.env.ADMIN_EMAIL ||
    "admin@bmjservice.com";

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD ||
    "BMJAdmin@2026";

const ADMIN_SECRET =
    process.env.ADMIN_SECRET ||
    "BMJ_SERVICE_ADMIN_SECRET_2026_CHANGE_ME";

const JUSTIN_ADMIN_NAME =
    process.env.JUSTIN_ADMIN_NAME ||
    "MUSSIWA JUSTIN";

const JUSTIN_ADMIN_EMAIL =
    process.env.JUSTIN_ADMIN_EMAIL ||
    "mussiwajustin@gmail.com";

const JUSTIN_ADMIN_PASSWORD =
    process.env.JUSTIN_ADMIN_PASSWORD ||
    "Justin_BMJ_2026!";

const TOKEN_DURATION_SECONDS = 24 * 60 * 60;

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

pool.on("error", (error) => {
    console.error(
        "Erreur PostgreSQL sur connexion inactive :",
        error
    );
});

// ============================================================
// CORS
// ============================================================

app.use(
    cors({
        origin: true,
        credentials: false,

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
            "Accept",
            "X-Admin-Token"
        ]
    })
);

// ============================================================
// BODY PARSER
// ============================================================

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
    const started = Date.now();

    res.on("finish", () => {
        const duration =
            Date.now() - started;

        console.log(
            `${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`
        );
    });

    next();
});

// ============================================================
// OUTILS
// ============================================================

function cleanString(value, maxLength = 255) {
    if (
        value === undefined ||
        value === null
    ) {
        return "";
    }

    return String(value)
        .trim()
        .slice(0, maxLength);
}

function normalizeEmail(value) {
    return cleanString(
        value,
        320
    ).toLowerCase();
}

function parseId(value) {
    const id = Number(value);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        return null;
    }

    return id;
}

function safeNumber(value, fallback = 0) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}

function clamp(value, min, max) {
    return Math.min(
        Math.max(
            Number(value) || 0,
            min
        ),
        max
    );
}

function toBoolean(value) {
    if (
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true" ||
        value === "TRUE" ||
        value === "yes" ||
        value === "on"
    ) {
        return true;
    }

    return false;
}

// ============================================================
// REPONSES API
// ============================================================

function success(
    res,
    data = {},
    status = 200
) {
    return res.status(status).json({
        success: true,
        ...data
    });
}

function failure(
    res,
    message,
    status = 400,
    extra = {}
) {
    return res.status(status).json({
        success: false,
        message,
        ...extra
    });
}

// ============================================================
// MOT DE PASSE
// ============================================================

function hashPassword(password) {
    return new Promise(
        (resolve, reject) => {
            const cleanPassword =
                String(password || "");

            const salt =
                crypto.randomBytes(16).toString(
                    "hex"
                );

            crypto.scrypt(
                cleanPassword,
                salt,
                64,
                (error, derivedKey) => {
                    if (error) {
                        return reject(error);
                    }

                    resolve(
                        `scrypt:${salt}:${derivedKey.toString(
                            "hex"
                        )}`
                    );
                }
            );
        }
    );
}

function verifyPassword(
    password,
    storedPassword
) {
    return new Promise(
        (resolve, reject) => {
            if (
                !storedPassword
            ) {
                return resolve(false);
            }

            const stored =
                String(storedPassword);

            if (
                !stored.startsWith(
                    "scrypt:"
                )
            ) {
                return resolve(
                    String(password || "") ===
                        stored
                );
            }

            const parts =
                stored.split(":");

            if (
                parts.length !== 3
            ) {
                return resolve(false);
            }

            const salt = parts[1];
            const storedHash = parts[2];

            crypto.scrypt(
                String(password || ""),
                salt,
                64,
                (error, derivedKey) => {
                    if (error) {
                        return reject(error);
                    }

                    const currentHash =
                        derivedKey.toString(
                            "hex"
                        );

                    try {
                        const a =
                            Buffer.from(
                                currentHash,
                                "hex"
                            );

                        const b =
                            Buffer.from(
                                storedHash,
                                "hex"
                            );

                        if (
                            a.length !==
                            b.length
                        ) {
                            return resolve(
                                false
                            );
                        }

                        resolve(
                            crypto.timingSafeEqual(
                                a,
                                b
                            )
                        );
                    } catch {
                        resolve(false);
                    }
                }
            );
        }
    );
}

// ============================================================
// ETAT PREMIUM / BLOCAGE
// ============================================================

function isPremiumUser(user) {
    if (!user) {
        return false;
    }

    const premiumFlag =
        user.premium === true ||
        user.is_premium === true;

    if (!premiumFlag) {
        return false;
    }

    if (!user.premium_until) {
        return true;
    }

    const expiration =
        new Date(
            user.premium_until
        );

    if (
        Number.isNaN(
            expiration.getTime()
        )
    ) {
        return true;
    }

    return (
        expiration.getTime() >
        Date.now()
    );
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
// TOKEN ADMINISTRATEUR
// ============================================================

function createAdminToken(email) {
    const normalizedEmail =
        normalizeEmail(email);

    const timestamp =
        Math.floor(
            Date.now() / 1000
        );

    const payload =
        `${normalizedEmail}.${timestamp}`;

    const signature =
        crypto
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
    try {
        if (!token) {
            return null;
        }

        const decoded =
            Buffer.from(
                String(token),
                "base64url"
            ).toString("utf8");

        const parts =
            decoded.split(".");

        if (
            parts.length !== 3
        ) {
            return null;
        }

        const email = parts[0];

        const timestamp =
            Number(parts[1]);

        const signature =
            parts[2];

        if (
            !email ||
            !Number.isFinite(timestamp) ||
            !signature
        ) {
            return null;
        }

        const now =
            Math.floor(
                Date.now() / 1000
            );

        if (
            timestamp >
            now + 60
        ) {
            return null;
        }

        if (
            now - timestamp >
            TOKEN_DURATION_SECONDS
        ) {
            return null;
        }

        const payload =
            `${email}.${timestamp}`;

        const expectedSignature =
            crypto
                .createHmac(
                    "sha256",
                    ADMIN_SECRET
                )
                .update(payload)
                .digest("hex");

        const a =
            Buffer.from(
                signature,
                "utf8"
            );

        const b =
            Buffer.from(
                expectedSignature,
                "utf8"
            );

        if (
            a.length !==
            b.length
        ) {
            return null;
        }

        if (
            !crypto.timingSafeEqual(
                a,
                b
            )
        ) {
            return null;
        }

        return {
            email: normalizeEmail(email),
            timestamp
        };
    } catch {
        return null;
    }
}

function getAdminTokenFromRequest(req) {
    const authorization =
        cleanString(
            req.headers.authorization,
            10000
        );

    if (
        authorization
            .toLowerCase()
            .startsWith("bearer ")
    ) {
        return authorization
            .slice(7)
            .trim();
    }

    const headerToken =
        cleanString(
            req.headers["x-admin-token"],
            10000
        );

    if (headerToken) {
        return headerToken;
    }

    const queryToken =
        cleanString(
            req.query.token,
            10000
        );

    if (queryToken) {
        return queryToken;
    }

    return "";
}

// ============================================================
// AUTH ADMIN
// ============================================================

function adminAuth(req, res, next) {
    const token =
        getAdminTokenFromRequest(req);

    const admin =
        verifyAdminToken(token);

    if (!admin) {
        return failure(
            res,
            "Votre session administrateur n'est plus valide. Veuillez vous reconnecter.",
            401,
            {
                error:
                    "ADMIN_AUTH_REQUIRED",
                code:
                    "ADMIN_AUTH_REQUIRED"
            }
        );
    }

    req.adminEmail =
        admin.email;

    req.admin =
        admin;

    next();
}

// ============================================================
// ACTIVITES ADMIN
// ============================================================

async function logActivity({
    action,
    details = "",
    userId = null,
    ip = ""
}) {
    try {
        await pool.query(
            `
            INSERT INTO admin_activity
            (
                action,
                details,
                user_id,
                ip,
                created_at
            )
            VALUES
            ($1, $2, $3, $4, NOW())
            `,
            [
                cleanString(action, 255),
                cleanString(details, 5000),
                parseId(userId),
                cleanString(ip, 255)
            ]
        );
    } catch (error) {
        console.error(
            "Erreur journal admin :",
            error.message
        );
    }
}

// ============================================================
// UTILISATEURS DEMO
// ============================================================

const DEMO_PASSWORD =
    "BMJUser@2026";

const DEMO_USERS = Array.from(
    { length: 30 },
    (_, index) => {
        const number =
            index + 1;

        const domaines = [
            "Informatique",
            "Marketing",
            "Finance",
            "Entrepreneuriat",
            "Leadership",
            "Éducation",
            "Agriculture",
            "Beauté",
            "Intelligence Artificielle",
            "Langues"
        ];

        const villes = [
            "Kinshasa",
            "Lubumbashi",
            "Goma",
            "Bukavu",
            "Kolwezi",
            "Likasi",
            "Matadi",
            "Kisangani"
        ];

        return {
            nom:
                `Utilisateur Démo ${number}`,
            email:
                `demo${number}@bmjservice.com`,
            telephone:
                `+243810000${String(
                    number
                ).padStart(2, "0")}`,
            pays:
                "RDC",
            ville:
                villes[
                    index %
                        villes.length
                ],
            domaine:
                domaines[
                    index %
                        domaines.length
                ],
            niveau:
                index % 3 === 0
                    ? "Débutant"
                    : index % 3 === 1
                    ? "Intermédiaire"
                    : "Avancé",
            photo: ""
        };
    }
);

// ============================================================
// CREATION DES TABLES
// ============================================================

async function initDatabase() {
    console.log(
        "Connexion à PostgreSQL..."
    );

    const client =
        await pool.connect();

    try {
        // ----------------------------------------------------
        // USERS
        // ----------------------------------------------------

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                nom TEXT,
                email TEXT,
                telephone TEXT,
                domaine TEXT,
                pays TEXT,
                ville TEXT,
                niveau TEXT,
                password TEXT,
                photo TEXT,
                role TEXT DEFAULT 'user',
                premium BOOLEAN DEFAULT FALSE,
                is_premium BOOLEAN DEFAULT FALSE,
                premium_until TIMESTAMP NULL,
                blocked BOOLEAN DEFAULT FALSE,
                is_blocked BOOLEAN DEFAULT FALSE,
                certificate_authorized BOOLEAN DEFAULT FALSE,
                certificate_authorized_at TIMESTAMP NULL,
                certificate_authorized_by TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS nom TEXT
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS email TEXT
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS telephone TEXT
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS domaine TEXT
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS pays TEXT
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS ville TEXT
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS niveau TEXT
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS password TEXT
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS photo TEXT
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS premium BOOLEAN DEFAULT FALSE
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS premium_until TIMESTAMP NULL
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS certificate_authorized BOOLEAN DEFAULT FALSE
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS certificate_authorized_at TIMESTAMP NULL
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS certificate_authorized_by TEXT
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
        `);

        // ----------------------------------------------------
        // PAIEMENTS
        // ----------------------------------------------------

        await client.query(`
            CREATE TABLE IF NOT EXISTS paiements (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                nom TEXT,
                email TEXT,
                telephone TEXT,
                amount NUMERIC(12,2) DEFAULT 0,
                montant NUMERIC(12,2) DEFAULT 0,
                currency TEXT DEFAULT 'USD',
                methode TEXT,
                proof TEXT,
                proof_url TEXT,
                proof_type TEXT,
                recipient_number TEXT,
                recipient_name TEXT,
                status TEXT DEFAULT 'pending',
                premium_days INTEGER DEFAULT 30,
                notes TEXT,
                validated_at TIMESTAMP NULL,
                refused_at TIMESTAMP NULL,
                refusal_reason TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        const paymentColumns = [
            ["user_id", "INTEGER"],
            ["nom", "TEXT"],
            ["email", "TEXT"],
            ["telephone", "TEXT"],
            ["amount", "NUMERIC(12,2) DEFAULT 0"],
            ["montant", "NUMERIC(12,2) DEFAULT 0"],
            ["currency", "TEXT DEFAULT 'USD'"],
            ["methode", "TEXT"],
            ["proof", "TEXT"],
            ["proof_url", "TEXT"],
            ["proof_type", "TEXT"],
            ["recipient_number", "TEXT"],
            ["recipient_name", "TEXT"],
            ["status", "TEXT DEFAULT 'pending'"],
            ["premium_days", "INTEGER DEFAULT 30"],
            ["notes", "TEXT"],
            ["validated_at", "TIMESTAMP NULL"],
            ["refused_at", "TIMESTAMP NULL"],
            ["refusal_reason", "TEXT"],
            ["created_at", "TIMESTAMP DEFAULT NOW()"],
            ["updated_at", "TIMESTAMP DEFAULT NOW()"]
        ];

        for (
            const [column, type]
            of paymentColumns
        ) {
            await client.query(`
                ALTER TABLE paiements
                ADD COLUMN IF NOT EXISTS ${column} ${type}
            `);
        }

        // ----------------------------------------------------
        // DEMANDES PAIEMENT
        // ----------------------------------------------------

        await client.query(`
            CREATE TABLE IF NOT EXISTS demandes_paiement (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                telephone_paiement TEXT,
                reference_paiement TEXT,
                amount NUMERIC(12,2) DEFAULT 0,
                montant NUMERIC(12,2) DEFAULT 0,
                currency TEXT DEFAULT 'USD',
                methode TEXT,
                proof TEXT,
                recipient_number TEXT,
                recipient_name TEXT,
                status TEXT DEFAULT 'pending',
                premium_days INTEGER DEFAULT 30,
                notes TEXT,
                validated_at TIMESTAMP NULL,
                refused_at TIMESTAMP NULL,
                refusal_reason TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        const requestColumns = [
            ["user_id", "INTEGER"],
            ["telephone_paiement", "TEXT"],
            ["reference_paiement", "TEXT"],
            ["amount", "NUMERIC(12,2) DEFAULT 0"],
            ["montant", "NUMERIC(12,2) DEFAULT 0"],
            ["currency", "TEXT DEFAULT 'USD'"],
            ["methode", "TEXT"],
            ["proof", "TEXT"],
            ["recipient_number", "TEXT"],
            ["recipient_name", "TEXT"],
            ["status", "TEXT DEFAULT 'pending'"],
            ["premium_days", "INTEGER DEFAULT 30"],
            ["notes", "TEXT"],
            ["validated_at", "TIMESTAMP NULL"],
            ["refused_at", "TIMESTAMP NULL"],
            ["refusal_reason", "TEXT"],
            ["created_at", "TIMESTAMP DEFAULT NOW()"],
            ["updated_at", "TIMESTAMP DEFAULT NOW()"]
        ];

        for (
            const [column, type]
            of requestColumns
        ) {
            await client.query(`
                ALTER TABLE demandes_paiement
                ADD COLUMN IF NOT EXISTS ${column} ${type}
            `);
        }

        // ----------------------------------------------------
        // MESSAGES
        // ----------------------------------------------------

        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                sender_type TEXT,
                sender_user_id INTEGER,
                sender_name TEXT,
                sender_email TEXT,
                recipient_user_id INTEGER,
                recipient_name TEXT,
                recipient_email TEXT,
                subject TEXT,
                content TEXT,
                type TEXT DEFAULT 'standard',
                priority TEXT DEFAULT 'normal',
                audience TEXT DEFAULT 'user',
                status TEXT DEFAULT 'unread',
                read_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // ----------------------------------------------------
        // COURSE PROGRESS
        // ----------------------------------------------------

        await client.query(`
            CREATE TABLE IF NOT EXISTS course_progress (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                domaine TEXT NOT NULL,
                progression NUMERIC(6,2) DEFAULT 0,
                lessons_completed INTEGER DEFAULT 0,
                total_lessons INTEGER DEFAULT 0,
                last_lesson TEXT,
                last_lesson_title TEXT,
                completed BOOLEAN DEFAULT FALSE,
                started_at TIMESTAMP DEFAULT NOW(),
                completed_at TIMESTAMP NULL,
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, domaine)
            )
        `);

        // ----------------------------------------------------
        // ACTIVITES ADMIN
        // ----------------------------------------------------

        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_activity (
                id SERIAL PRIMARY KEY,
                action TEXT,
                details TEXT,
                user_id INTEGER,
                ip TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // ----------------------------------------------------
        // INDEX
        // ----------------------------------------------------

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_email
            ON users (LOWER(email))
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_domaine
            ON users (domaine)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_premium
            ON users (premium, is_premium)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_blocked
            ON users (blocked, is_blocked)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_created
            ON users (created_at DESC)
        `);

        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_course_progress_unique
            ON course_progress (user_id, domaine)
        `);

        // ----------------------------------------------------
        // NORMALISATION SANS SUPPRESSION
        // ----------------------------------------------------

        await client.query(`
            UPDATE users
            SET
                role = COALESCE(role, 'user'),
                premium = COALESCE(premium, FALSE),
                is_premium = COALESCE(is_premium, FALSE),
                blocked = COALESCE(blocked, FALSE),
                is_blocked = COALESCE(is_blocked, FALSE),
                certificate_authorized =
                    COALESCE(certificate_authorized, FALSE),
                created_at =
                    COALESCE(created_at, NOW()),
                updated_at =
                    COALESCE(updated_at, NOW())
        `);

        // ----------------------------------------------------
        // CREATION ADMIN JUSTIN SI ABSENT
        // ----------------------------------------------------

        const justinEmail =
            normalizeEmail(
                JUSTIN_ADMIN_EMAIL
            );

        const justinResult =
            await client.query(
                `
                SELECT *
                FROM users
                WHERE LOWER(email) = $1
                LIMIT 1
                `,
                [justinEmail]
            );

        if (
            justinResult.rows.length === 0
        ) {
            const hashed =
                await hashPassword(
                    JUSTIN_ADMIN_PASSWORD
                );

            await client.query(
                `
                INSERT INTO users
                (
                    nom,
                    email,
                    password,
                    role,
                    premium,
                    is_premium,
                    blocked,
                    is_blocked,
                    certificate_authorized,
                    created_at,
                    updated_at
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    'admin',
                    TRUE,
                    TRUE,
                    FALSE,
                    FALSE,
                    TRUE,
                    NOW(),
                    NOW()
                )
                `,
                [
                    JUSTIN_ADMIN_NAME,
                    justinEmail,
                    hashed
                ]
            );

            console.log(
                "Compte administrateur Justin créé."
            );
        } else {
            const current =
                justinResult.rows[0];

            let passwordOk =
                await verifyPassword(
                    JUSTIN_ADMIN_PASSWORD,
                    current.password
                );

            let passwordToStore =
                current.password;

            if (!passwordOk) {
                passwordToStore =
                    await hashPassword(
                        JUSTIN_ADMIN_PASSWORD
                    );
            }

            await client.query(
                `
                UPDATE users
                SET
                    role = 'admin',
                    blocked = FALSE,
                    is_blocked = FALSE,
                    password = $1,
                    updated_at = NOW()
                WHERE id = $2
                `,
                [
                    passwordToStore,
                    current.id
                ]
            );
        }

        // ----------------------------------------------------
        // UTILISATEURS DEMO
        // INSERTION UNIQUEMENT S'ILS N'EXISTENT PAS
        // ----------------------------------------------------

        const demoHash =
            await hashPassword(
                DEMO_PASSWORD
            );

        for (
            const demo of DEMO_USERS
        ) {
            const existing =
                await client.query(
                    `
                    SELECT id
                    FROM users
                    WHERE LOWER(email) = $1
                    LIMIT 1
                    `,
                    [
                        normalizeEmail(
                            demo.email
                        )
                    ]
                );

            if (
                existing.rows.length > 0
            ) {
                continue;
            }

            await client.query(
                `
                INSERT INTO users
                (
                    nom,
                    email,
                    telephone,
                    domaine,
                    pays,
                    ville,
                    niveau,
                    password,
                    photo,
                    role,
                    premium,
                    is_premium,
                    blocked,
                    is_blocked,
                    certificate_authorized,
                    created_at,
                    updated_at
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    'user',
                    FALSE,
                    FALSE,
                    FALSE,
                    FALSE,
                    FALSE,
                    NOW(),
                    NOW()
                )
                `,
                [
                    demo.nom,
                    normalizeEmail(
                        demo.email
                    ),
                    demo.telephone,
                    demo.domaine,
                    demo.pays,
                    demo.ville,
                    demo.niveau,
                    demoHash,
                    demo.photo
                ]
            );
        }

        const countResult =
            await client.query(
                `SELECT COUNT(*)::INTEGER AS total FROM users`
            );

        console.log(
            `Utilisateurs présents dans PostgreSQL : ${countResult.rows[0].total}`
        );

        console.log(
            "Base de données initialisée sans suppression des données."
        );
    } finally {
        client.release();
    }
}

// ============================================================
// ROUTES GENERALES
// ============================================================

app.get("/", (req, res) => {
    return res.json({
        success: true,
        name: "BMJ SERVICE",
        message:
            "BMJ SERVICE API active",
        version: "14.0.0",
        database:
            "PostgreSQL",
        users_route:
            "/api/admin/users",
        health:
            "/api/health"
    });
});

app.get("/api", (req, res) => {
    return success(res, {
        message:
            "BMJ SERVICE API active",
        version: "14.0.0"
    });
});

app.get(
    "/api/health",
    async (req, res) => {
        try {
            await pool.query(
                "SELECT 1"
            );

            return success(res, {
                status: "ok",
                database:
                    "connected",
                timestamp:
                    new Date().toISOString()
            });
        } catch (error) {
            return failure(
                res,
                "Base de données indisponible.",
                503,
                {
                    database:
                        "disconnected"
                }
            );
        }
    }
);

app.get(
    "/api/test-db",
    async (req, res) => {
        try {
            const result =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER AS total
                    FROM users
                    `
                );

            return success(res, {
                database:
                    "connected",
                users:
                    result.rows[0].total
            });
        } catch (error) {
            return failure(
                res,
                "Impossible de tester PostgreSQL.",
                500,
                {
                    details:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// INSCRIPTION
// ============================================================

async function registerUser(
    req,
    res
) {
    try {
        const body =
            req.body || {};

        const nom =
            cleanString(
                body.nom ||
                    body.name,
                255
            );

        const email =
            normalizeEmail(
                body.email
            );

        const telephone =
            cleanString(
                body.telephone ||
                    body.phone,
                100
            );

        const pays =
            cleanString(
                body.pays ||
                    "RDC",
                100
            );

        const ville =
            cleanString(
                body.ville,
                150
            );

        const domaine =
            cleanString(
                body.domaine ||
                    body.domain,
                255
            );

        const niveau =
            cleanString(
                body.niveau,
                100
            );

        const password =
            String(
                body.password ||
                    ""
            );

        const photo =
            cleanString(
                body.photo,
                20000000
            );

        if (!nom) {
            return failure(
                res,
                "Le nom est obligatoire."
            );
        }

        if (!email) {
            return failure(
                res,
                "L'adresse email est obligatoire."
            );
        }

        if (!password) {
            return failure(
                res,
                "Le mot de passe est obligatoire."
            );
        }

        const existing =
            await pool.query(
                `
                SELECT id
                FROM users
                WHERE LOWER(email) = $1
                LIMIT 1
                `,
                [email]
            );

        if (
            existing.rows.length > 0
        ) {
            return failure(
                res,
                "Cette adresse email est déjà utilisée.",
                409
            );
        }

        const hashed =
            await hashPassword(
                password
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
                    pays,
                    ville,
                    niveau,
                    password,
                    photo,
                    role,
                    premium,
                    is_premium,
                    blocked,
                    is_blocked,
                    certificate_authorized,
                    created_at,
                    updated_at
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    'user',
                    FALSE,
                    FALSE,
                    FALSE,
                    FALSE,
                    FALSE,
                    NOW(),
                    NOW()
                )
                RETURNING
                    id,
                    nom,
                    email,
                    telephone,
                    domaine,
                    pays,
                    ville,
                    niveau,
                    photo,
                    role,
                    premium,
                    is_premium,
                    premium_until,
                    blocked,
                    is_blocked,
                    certificate_authorized,
                    created_at,
                    updated_at
                `,
                [
                    nom,
                    email,
                    telephone,
                    domaine,
                    pays,
                    ville,
                    niveau,
                    hashed,
                    photo
                ]
            );

        const user =
            result.rows[0];

        return success(
            res,
            {
                message:
                    "Inscription réussie.",
                user,
                utilisateur:
                    user
            },
            201
        );
    } catch (error) {
        console.error(
            "Erreur inscription :",
            error
        );

        return failure(
            res,
            "Impossible de créer le compte.",
            500,
            {
                details:
                    error.message
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

async function loginUser(
    req,
    res
) {
    try {
        const email =
            normalizeEmail(
                req.body?.email
            );

        const password =
            String(
                req.body?.password ||
                    ""
            );

        if (!email || !password) {
            return failure(
                res,
                "Email et mot de passe obligatoires."
            );
        }

        const result =
            await pool.query(
                `
                SELECT *
                FROM users
                WHERE LOWER(email) = $1
                LIMIT 1
                `,
                [email]
            );

        if (
            result.rows.length === 0
        ) {
            return failure(
                res,
                "Email ou mot de passe incorrect.",
                401
            );
        }

        const user =
            result.rows[0];

        const passwordOk =
            await verifyPassword(
                password,
                user.password
            );

        if (!passwordOk) {
            return failure(
                res,
                "Email ou mot de passe incorrect.",
                401
            );
        }

        if (
            isBlockedUser(user)
        ) {
            return failure(
                res,
                "Votre compte est bloqué par l'administration.",
                403
            );
        }

        const safeUser = {
            id: user.id,
            nom: user.nom,
            email: user.email,
            telephone:
                user.telephone,
            domaine:
                user.domaine,
            pays:
                user.pays,
            ville:
                user.ville,
            niveau:
                user.niveau,
            photo:
                user.photo,
            role:
                user.role,
            premium:
                isPremiumUser(user),
            is_premium:
                isPremiumUser(user),
            premium_until:
                user.premium_until,
            blocked:
                false,
            is_blocked:
                false,
            certificate_authorized:
                Boolean(
                    user.certificate_authorized
                ),
            created_at:
                user.created_at,
            updated_at:
                user.updated_at
        };

        return success(res, {
            message:
                "Connexion réussie.",
            user:
                safeUser,
            utilisateur:
                safeUser
        });
    } catch (error) {
        console.error(
            "Erreur connexion :",
            error
        );

        return failure(
            res,
            "Impossible de se connecter.",
            500
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
            const email =
                normalizeEmail(
                    req.body?.email
                );

            const password =
                String(
                    req.body?.password ||
                        ""
                );

            if (
                !email ||
                !password
            ) {
                return failure(
                    res,
                    "Email et mot de passe administrateur obligatoires."
                );
            }

            // ------------------------------------------------
            // ADMIN PRINCIPAL ENV
            // ------------------------------------------------

            if (
                email ===
                    normalizeEmail(
                        ADMIN_EMAIL
                    ) &&
                password ===
                    ADMIN_PASSWORD
            ) {
                const token =
                    createAdminToken(
                        email
                    );

                return success(
                    res,
                    {
                        message:
                            "Connexion administrateur réussie.",
                        token,
                        adminToken:
                            token,
                        accessToken:
                            token,
                        admin: {
                            email,
                            nom:
                                "Administrateur BMJ SERVICE",
                            role:
                                "admin"
                        }
                    }
                );
            }

            // ------------------------------------------------
            // ADMIN JUSTIN EN BASE
            // ------------------------------------------------

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM users
                    WHERE LOWER(email) = $1
                    AND role = 'admin'
                    LIMIT 1
                    `,
                    [email]
                );

            if (
                result.rows.length === 0
            ) {
                return failure(
                    res,
                    "Identifiants administrateur incorrects.",
                    401
                );
            }

            const admin =
                result.rows[0];

            const passwordOk =
                await verifyPassword(
                    password,
                    admin.password
                );

            if (!passwordOk) {
                return failure(
                    res,
                    "Identifiants administrateur incorrects.",
                    401
                );
            }

            if (
                isBlockedUser(admin)
            ) {
                return failure(
                    res,
                    "Ce compte administrateur est bloqué.",
                    403
                );
            }

            const token =
                createAdminToken(
                    email
                );

            return success(
                res,
                {
                    message:
                        "Connexion administrateur réussie.",
                    token,
                    adminToken:
                        token,
                    accessToken:
                        token,
                    admin: {
                        id:
                            admin.id,
                        nom:
                            admin.nom,
                        email:
                            admin.email,
                        role:
                            "admin"
                    }
                }
            );
        } catch (error) {
            console.error(
                "Erreur connexion admin :",
                error
            );

            return failure(
                res,
                "Impossible de connecter l'administrateur.",
                500
            );
        }
    }
);

// ============================================================
// SESSION ADMIN — VERIFICATION TOKEN UNIQUEMENT
// ============================================================

app.get(
    "/api/admin/session",
    adminAuth,
    async (req, res) => {
        return success(res, {
            authenticated:
                true,
            admin: {
                email:
                    req.adminEmail,
                role:
                    "admin"
            }
        });
    }
);

// ============================================================
// FONCTION LISTE UTILISATEURS
// ============================================================

async function getAllUsersFromDatabase() {
    const result =
        await pool.query(
            `
            SELECT
                id,
                nom,
                email,
                telephone,
                domaine,
                pays,
                ville,
                niveau,
                photo,
                role,
                premium,
                is_premium,
                premium_until,
                blocked,
                is_blocked,
                certificate_authorized,
                certificate_authorized_at,
                certificate_authorized_by,
                created_at,
                updated_at
            FROM users
            ORDER BY id DESC
            `
        );

    return result.rows.map(
        (user) => {
            const premium =
                isPremiumUser(
                    user
                );

            const blocked =
                isBlockedUser(
                    user
                );

            return {
                ...user,

                premium,
                is_premium:
                    premium,

                blocked,
                is_blocked:
                    blocked,

                certificate_authorized:
                    Boolean(
                        user.certificate_authorized
                    )
            };
        }
    );
}

// ============================================================
// LISTE UTILISATEURS ADMIN
// ============================================================

// ROUTE PRINCIPALE
app.get(
    "/api/admin/users",
    adminAuth,
    async (req, res) => {
        try {
            const users =
                await getAllUsersFromDatabase();

            return success(res, {
                users,
                utilisateurs:
                    users,
                apprenants:
                    users,
                total:
                    users.length,
                count:
                    users.length
            });
        } catch (error) {
            console.error(
                "Erreur liste utilisateurs :",
                error
            );

            return failure(
                res,
                "Impossible de récupérer les utilisateurs.",
                500
            );
        }
    }
);

// ALIAS FRANCAIS
app.get(
    "/api/admin/utilisateurs",
    adminAuth,
    async (req, res) => {
        try {
            const users =
                await getAllUsersFromDatabase();

            return success(res, {
                utilisateurs:
                    users,
                users,
                apprenants:
                    users,
                total:
                    users.length,
                count:
                    users.length
            });
        } catch (error) {
            console.error(
                "Erreur utilisateurs admin :",
                error
            );

            return failure(
                res,
                "Impossible de récupérer les utilisateurs.",
                500
            );
        }
    }
);

// ============================================================
// UTILISATEUR PAR ID
// ============================================================

app.get(
    "/api/utilisateurs/:id",
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
                        pays,
                        ville,
                        niveau,
                        photo,
                        role,
                        premium,
                        is_premium,
                        premium_until,
                        blocked,
                        is_blocked,
                        certificate_authorized,
                        certificate_authorized_at,
                        certificate_authorized_by,
                        created_at,
                        updated_at
                    FROM users
                    WHERE id = $1
                    `,
                    [id]
                );

            if (
                result.rows.length === 0
            ) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            const user =
                result.rows[0];

            user.premium =
                isPremiumUser(
                    user
                );

            user.is_premium =
                user.premium;

            user.blocked =
                isBlockedUser(
                    user
                );

            user.is_blocked =
                user.blocked;

            return success(res, {
                user,
                utilisateur:
                    user
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de récupérer l'utilisateur.",
                500
            );
        }
    }
);

// ============================================================
// ALIAS APPRENANTS
// ============================================================

app.get(
    "/api/apprenants",
    adminAuth,
    async (req, res) => {
        try {
            const users =
                await getAllUsersFromDatabase();

            return success(res, {
                apprenants:
                    users,
                users,
                utilisateurs:
                    users,
                total:
                    users.length
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de récupérer les apprenants.",
                500
            );
        }
    }
);

// ============================================================
// MODIFICATION UTILISATEUR
// ============================================================

app.patch(
    "/api/admin/users/:id",
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
                    "ID utilisateur invalide."
                );
            }

            const body =
                req.body || {};

            const fields = [];
            const values = [];

            function addField(
                field,
                value
            ) {
                values.push(value);

                fields.push(
                    `${field} = $${values.length}`
                );
            }

            if (
                body.nom !==
                    undefined
            ) {
                addField(
                    "nom",
                    cleanString(
                        body.nom,
                        255
                    )
                );
            }

            if (
                body.email !==
                    undefined
            ) {
                addField(
                    "email",
                    normalizeEmail(
                        body.email
                    )
                );
            }

            if (
                body.telephone !==
                    undefined ||
                body.phone !==
                    undefined
            ) {
                addField(
                    "telephone",
                    cleanString(
                        body.telephone ??
                            body.phone,
                        100
                    )
                );
            }

            if (
                body.domaine !==
                    undefined
            ) {
                addField(
                    "domaine",
                    cleanString(
                        body.domaine,
                        255
                    )
                );
            }

            if (
                body.pays !==
                    undefined
            ) {
                addField(
                    "pays",
                    cleanString(
                        body.pays,
                        100
                    )
                );
            }

            if (
                body.ville !==
                    undefined
            ) {
                addField(
                    "ville",
                    cleanString(
                        body.ville,
                        150
                    )
                );
            }

            if (
                body.niveau !==
                    undefined
            ) {
                addField(
                    "niveau",
                    cleanString(
                        body.niveau,
                        100
                    )
                );
            }

            if (
                body.photo !==
                    undefined
            ) {
                addField(
                    "photo",
                    cleanString(
                        body.photo,
                        20000000
                    )
                );
            }

            if (
                body.password
            ) {
                addField(
                    "password",
                    await hashPassword(
                        body.password
                    )
                );
            }

            if (
                fields.length === 0
            ) {
                return failure(
                    res,
                    "Aucune modification fournie."
                );
            }

            values.push(id);

            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        ${fields.join(", ")},
                        updated_at = NOW()
                    WHERE id = $${values.length}
                    RETURNING
                        id,
                        nom,
                        email,
                        telephone,
                        domaine,
                        pays,
                        ville,
                        niveau,
                        photo,
                        role,
                        premium,
                        is_premium,
                        premium_until,
                        blocked,
                        is_blocked,
                        certificate_authorized,
                        certificate_authorized_at,
                        certificate_authorized_by,
                        created_at,
                        updated_at
                    `,
                    values
                );

            if (
                result.rows.length === 0
            ) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            await logActivity({
                action:
                    "UPDATE_USER",
                details:
                    `Utilisateur ${id} modifié`,
                userId:
                    id,
                ip:
                    req.headers[
                        "x-forwarded-for"
                    ] ||
                    req.socket
                        .remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    "Utilisateur modifié avec succès.",
                user:
                    result.rows[0],
                utilisateur:
                    result.rows[0]
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de modifier l'utilisateur.",
                500
            );
        }
    }
);

// ============================================================
// BLOQUER
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

            if (!id) {
                return failure(
                    res,
                    "ID utilisateur invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        blocked = TRUE,
                        is_blocked = TRUE,
                        updated_at = NOW()
                    WHERE id = $1
                    RETURNING
                        id,
                        nom,
                        email,
                        blocked,
                        is_blocked
                    `,
                    [id]
                );

            if (
                result.rows.length === 0
            ) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            await logActivity({
                action:
                    "BLOCK_USER",
                details:
                    `Utilisateur ${id} bloqué`,
                userId:
                    id,
                ip:
                    req.headers[
                        "x-forwarded-for"
                    ] ||
                    req.socket
                        .remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    "Utilisateur bloqué avec succès.",
                user:
                    result.rows[0],
                utilisateur:
                    result.rows[0]
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de bloquer l'utilisateur.",
                500
            );
        }
    }
);

// ============================================================
// DEBLOQUER
// ============================================================

app.patch(
    "/api/admin/users/:id/unblock",
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
                    "ID utilisateur invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        blocked = FALSE,
                        is_blocked = FALSE,
                        updated_at = NOW()
                    WHERE id = $1
                    RETURNING
                        id,
                        nom,
                        email,
                        blocked,
                        is_blocked
                    `,
                    [id]
                );

            if (
                result.rows.length === 0
            ) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            await logActivity({
                action:
                    "UNBLOCK_USER",
                details:
                    `Utilisateur ${id} débloqué`,
                userId:
                    id,
                ip:
                    req.headers[
                        "x-forwarded-for"
                    ] ||
                    req.socket
                        .remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    "Utilisateur débloqué avec succès.",
                user:
                    result.rows[0],
                utilisateur:
                    result.rows[0]
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de débloquer l'utilisateur.",
                500
            );
        }
    }
);

// ============================================================
// ROUTE COMPATIBILITE BLOCAGE
// ============================================================

app.patch(
    "/api/admin/utilisateurs/:id/blocage",
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
                    "ID utilisateur invalide."
                );
            }

            const blocked =
                toBoolean(
                    req.body?.blocked
                );

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

            if (
                result.rows.length === 0
            ) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            await logActivity({
                action:
                    blocked
                        ? "BLOCK_USER"
                        : "UNBLOCK_USER",
                details:
                    `Changement de blocage utilisateur ${id}`,
                userId:
                    id,
                ip:
                    req.headers[
                        "x-forwarded-for"
                    ] ||
                    req.socket
                        .remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    blocked
                        ? "Utilisateur bloqué."
                        : "Utilisateur débloqué.",
                user:
                    result.rows[0],
                utilisateur:
                    result.rows[0]
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de modifier le blocage.",
                500
            );
        }
    }
);

// ============================================================
// PREMIUM — ACTIVATION
// ============================================================

async function activatePremium(
    userId,
    days
) {
    const id =
        parseId(userId);

    if (!id) {
        return null;
    }

    const safeDays =
        Math.max(
            1,
            Math.floor(
                safeNumber(
                    days,
                    30
                )
            )
        );

    const result =
        await pool.query(
            `
            SELECT
                id,
                nom,
                email,
                premium_until
            FROM users
            WHERE id = $1
            `,
            [id]
        );

    if (
        result.rows.length === 0
    ) {
        return null;
    }

    const user =
        result.rows[0];

    let startDate =
        new Date();

    if (
        user.premium_until
    ) {
        const existing =
            new Date(
                user.premium_until
            );

        if (
            !Number.isNaN(
                existing.getTime()
            ) &&
            existing.getTime() >
                Date.now()
        ) {
            startDate =
                existing;
        }
    }

    const expiration =
        new Date(
            startDate.getTime() +
                safeDays *
                    24 *
                    60 *
                    60 *
                    1000
        );

    const updated =
        await pool.query(
            `
            UPDATE users
            SET
                premium = TRUE,
                is_premium = TRUE,
                premium_until = $1,
                updated_at = NOW()
            WHERE id = $2
            RETURNING
                id,
                nom,
                email,
                premium,
                is_premium,
                premium_until
            `,
            [
                expiration,
                id
            ]
        );

    return updated.rows[0];
}

// ============================================================
// PREMIUM
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
                    "ID utilisateur invalide."
                );
            }

            const days =
                Math.max(
                    1,
                    Math.floor(
                        safeNumber(
                            req.body?.days ??
                                req.body?.premium_days,
                            30
                        )
                    )
                );

            const user =
                await activatePremium(
                    id,
                    days
                );

            if (!user) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            await logActivity({
                action:
                    "ACTIVATE_PREMIUM",
                details:
                    `Premium activé pour ${days} jours — utilisateur ${id}`,
                userId:
                    id,
                ip:
                    req.headers[
                        "x-forwarded-for"
                    ] ||
                    req.socket
                        .remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    `Premium activé pour ${days} jours.`,
                user,
                utilisateur:
                    user
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible d'activer Premium.",
                500
            );
        }
    }
);

// ============================================================
// STANDARD
// ============================================================

app.patch(
    "/api/admin/users/:id/standard",
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
                    "ID utilisateur invalide."
                );
            }

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
                    RETURNING
                        id,
                        nom,
                        email,
                        premium,
                        is_premium,
                        premium_until
                    `,
                    [id]
                );

            if (
                result.rows.length === 0
            ) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            await logActivity({
                action:
                    "REMOVE_PREMIUM",
                details:
                    `Premium retiré pour l'utilisateur ${id}`,
                userId:
                    id,
                ip:
                    req.headers[
                        "x-forwarded-for"
                    ] ||
                    req.socket
                        .remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    "Utilisateur repassé en Standard.",
                user:
                    result.rows[0],
                utilisateur:
                    result.rows[0]
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de retirer Premium.",
                500
            );
        }
    }
);

// ============================================================
// AUTORISATION CERTIFICAT
// ============================================================

app.patch(
    "/api/admin/users/:id/certificate",
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
                    "ID utilisateur invalide."
                );
            }

            const authorized =
                toBoolean(
                    req.body?.authorized ??
                        req.body?.certificate_authorized
                );

            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        certificate_authorized = $1,
                        certificate_authorized_at =
                            CASE
                                WHEN $1 = TRUE
                                THEN NOW()
                                ELSE NULL
                            END,
                        certificate_authorized_by =
                            CASE
                                WHEN $1 = TRUE
                                THEN $2
                                ELSE NULL
                            END,
                        updated_at = NOW()
                    WHERE id = $3
                    RETURNING
                        id,
                        nom,
                        email,
                        premium,
                        is_premium,
                        premium_until,
                        certificate_authorized,
                        certificate_authorized_at,
                        certificate_authorized_by
                    `,
                    [
                        authorized,
                        req.adminEmail,
                        id
                    ]
                );

            if (
                result.rows.length === 0
            ) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            await logActivity({
                action:
                    authorized
                        ? "AUTHORIZE_CERTIFICATE"
                        : "REMOVE_CERTIFICATE_AUTHORIZATION",
                details:
                    `Certificat ${
                        authorized
                            ? "autorisé"
                            : "désautorisé"
                    } pour l'utilisateur ${id}`,
                userId:
                    id,
                ip:
                    req.headers[
                        "x-forwarded-for"
                    ] ||
                    req.socket
                        .remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    authorized
                        ? "Certificat autorisé."
                        : "Autorisation du certificat retirée.",
                user:
                    result.rows[0],
                utilisateur:
                    result.rows[0]
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de modifier l'autorisation du certificat.",
                500
            );
        }
    }
);

// ============================================================
// ACCES CERTIFICAT
// ============================================================

app.get(
    "/api/users/:id/certificate-access",
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
                        premium,
                        is_premium,
                        premium_until,
                        certificate_authorized,
                        blocked,
                        is_blocked
                    FROM users
                    WHERE id = $1
                    `,
                    [id]
                );

            if (
                result.rows.length === 0
            ) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            const user =
                result.rows[0];

            const premium =
                isPremiumUser(
                    user
                );

            const blocked =
                isBlockedUser(
                    user
                );

            const allowed =
                !blocked &&
                premium &&
                Boolean(
                    user.certificate_authorized
                );

            return success(res, {
                certificate_allowed:
                    allowed,
                allowed,
                premium,
                blocked,
                certificate_authorized:
                    Boolean(
                        user.certificate_authorized
                    ),
                user_id:
                    user.id
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de vérifier le certificat.",
                500
            );
        }
    }
);

// ============================================================
// PAIEMENT — CREATION
// ============================================================

app.post(
    "/api/paiements",
    async (req, res) => {
        try {
            const body =
                req.body || {};

            const userId =
                parseId(
                    body.user_id ||
                        body.userId
                );

            const nom =
                cleanString(
                    body.nom,
                    255
                );

            const email =
                normalizeEmail(
                    body.email
                );

            const telephone =
                cleanString(
                    body.telephone ||
                        body.phone,
                    100
                );

            const amount =
                safeNumber(
                    body.amount ??
                        body.montant,
                    0
                );

            const currency =
                cleanString(
                    body.currency ||
                        "USD",
                    20
                );

            const methode =
                cleanString(
                    body.methode ||
                        body.method ||
                        body.mode,
                    100
                );

            const proof =
                cleanString(
                    body.proof ||
                        body.preuve,
                    20 * 1024 * 1024
                );

            const proofUrl =
                cleanString(
                    body.proof_url,
                    5000
                );

            const proofType =
                cleanString(
                    body.proof_type,
                    100
                );

            const recipientNumber =
                cleanString(
                    body.recipient_number,
                    100
                );

            const recipientName =
                cleanString(
                    body.recipient_name,
                    255
                );

            const premiumDays =
                Math.max(
                    1,
                    Math.floor(
                        safeNumber(
                            body.premium_days,
                            30
                        )
                    )
                );

            const notes =
                cleanString(
                    body.notes,
                    5000
                );

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
                        notes,
                        created_at,
                        updated_at
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9,
                        $10,
                        $11,
                        $12,
                        'pending',
                        $13,
                        $14,
                        NOW(),
                        NOW()
                    )
                    RETURNING *
                    `,
                    [
                        userId,
                        nom,
                        email,
                        telephone,
                        amount,
                        currency,
                        methode,
                        proof,
                        proofUrl,
                        proofType,
                        recipientNumber,
                        recipientName,
                        premiumDays,
                        notes
                    ]
                );

            return success(
                res,
                {
                    message:
                        "Paiement enregistré. Il sera vérifié par l'administration.",
                    paiement:
                        result.rows[0],
                    payment:
                        result.rows[0]
                },
                201
            );
        } catch (error) {
            console.error(
                "Erreur paiement :",
                error
            );

            return failure(
                res,
                "Impossible d'enregistrer le paiement.",
                500,
                {
                    details:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// LISTE PAIEMENTS ADMIN
// ============================================================

app.get(
    "/api/paiements",
    adminAuth,
    async (req, res) => {
        try {
            const result =
                await pool.query(
                    `
                    SELECT
                        p.*,
                        u.nom AS user_nom,
                        u.email AS user_email,
                        u.domaine AS user_domaine
                    FROM paiements p
                    LEFT JOIN users u
                        ON u.id = p.user_id
                    ORDER BY p.id DESC
                    `
                );

            return success(res, {
                paiements:
                    result.rows,
                payments:
                    result.rows,
                total:
                    result.rows.length
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de récupérer les paiements.",
                500
            );
        }
    }
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

            if (
                result.rows.length === 0
            ) {
                return failure(
                    res,
                    "Paiement introuvable.",
                    404
                );
            }

            return success(res, {
                paiement:
                    result.rows[0],
                payment:
                    result.rows[0]
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de récupérer le paiement.",
                500
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
                    "ID paiement invalide."
                );
            }

            await client.query(
                "BEGIN"
            );

            const paymentResult =
                await client.query(
                    `
                    SELECT *
                    FROM paiements
                    WHERE id = $1
                    FOR UPDATE
                    `,
                    [id]
                );

            if (
                paymentResult.rows.length ===
                0
            ) {
                await client.query(
                    "ROLLBACK"
                );

                return failure(
                    res,
                    "Paiement introuvable.",
                    404
                );
            }

            const payment =
                paymentResult.rows[0];

            const days =
                Math.max(
                    1,
                    Math.floor(
                        safeNumber(
                            req.body?.premium_days ??
                                payment.premium_days,
                            30
                        )
                    )
                );

            const userId =
                parseId(
                    payment.user_id
                );

            let activatedUser =
                null;

            if (userId) {
                activatedUser =
                    await activatePremiumForUser(
                        client,
                        userId,
                        days
                    );
            }

            const updatedPayment =
                await client.query(
                    `
                    UPDATE paiements
                    SET
                        status = 'validated',
                        premium_days = $1,
                        validated_at = NOW(),
                        refused_at = NULL,
                        refusal_reason = NULL,
                        updated_at = NOW()
                    WHERE id = $2
                    RETURNING *
                    `,
                    [
                        days,
                        id
                    ]
                );

            await client.query(
                "COMMIT"
            );

            await logActivity({
                action:
                    "VALIDATE_PAYMENT",
                details:
                    `Paiement ${id} validé`,
                userId,
                ip:
                    req.headers[
                        "x-forwarded-for"
                    ] ||
                    req.socket
                        .remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    "Paiement validé avec succès.",
                paiement:
                    updatedPayment.rows[0],
                payment:
                    updatedPayment.rows[0],
                user:
                    activatedUser,
                utilisateur:
                    activatedUser
            });
        } catch (error) {
            try {
                await client.query(
                    "ROLLBACK"
                );
            } catch {}

            console.error(
                "Erreur validation paiement :",
                error
            );

            return failure(
                res,
                "Impossible de valider le paiement.",
                500
            );
        } finally {
            client.release();
        }
    }
);

// ============================================================
// REFUSER PAIEMENT
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

            if (!id) {
                return failure(
                    res,
                    "ID paiement invalide."
                );
            }

            const reason =
                cleanString(
                    req.body?.reason ||
                        req.body?.refusal_reason ||
                        "Paiement refusé par l'administration.",
                    5000
                );

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
                    RETURNING *
                    `,
                    [
                        reason,
                        id
                    ]
                );

            if (
                result.rows.length ===
                0
            ) {
                return failure(
                    res,
                    "Paiement introuvable.",
                    404
                );
            }

            await logActivity({
                action:
                    "REFUSE_PAYMENT",
                details:
                    `Paiement ${id} refusé : ${reason}`,
                userId:
                    result.rows[0]
                        .user_id,
                ip:
                    req.headers[
                        "x-forwarded-for"
                    ] ||
                    req.socket
                        .remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    "Paiement refusé.",
                paiement:
                    result.rows[0],
                payment:
                    result.rows[0]
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de refuser le paiement.",
                500
            );
        }
    }
);

// ============================================================
// DEMANDE PAIEMENT
// ============================================================

app.post(
    "/api/demandes-paiement",
    async (req, res) => {
        try {
            const body =
                req.body || {};

            const userId =
                parseId(
                    body.user_id ||
                        body.userId
                );

            const telephonePaiement =
                cleanString(
                    body.telephone_paiement ||
                        body.telephone ||
                        body.phone,
                    100
                );

            const referencePaiement =
                cleanString(
                    body.reference_paiement ||
                        body.reference ||
                        body.referencePaiement,
                    255
                );

            const amount =
                safeNumber(
                    body.amount ??
                        body.montant,
                    0
                );

            const currency =
                cleanString(
                    body.currency ||
                        "USD",
                    20
                );

            const methode =
                cleanString(
                    body.methode ||
                        body.method,
                    100
                );

            const proof =
                cleanString(
                    body.proof ||
                        body.preuve,
                    20 * 1024 * 1024
                );

            const recipientNumber =
                cleanString(
                    body.recipient_number,
                    100
                );

            const recipientName =
                cleanString(
                    body.recipient_name,
                    255
                );

            const premiumDays =
                Math.max(
                    1,
                    Math.floor(
                        safeNumber(
                            body.premium_days,
                            30
                        )
                    )
                );

            const notes =
                cleanString(
                    body.notes,
                    5000
                );

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
                        status,
                        premium_days,
                        notes,
                        created_at,
                        updated_at
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9,
                        'pending',
                        $10,
                        $11,
                        NOW(),
                        NOW()
                    )
                    RETURNING *
                    `,
                    [
                        userId,
                        telephonePaiement,
                        referencePaiement,
                        amount,
                        currency,
                        methode,
                        proof,
                        recipientNumber,
                        recipientName,
                        premiumDays,
                        notes
                    ]
                );

            return success(
                res,
                {
                    message:
                        "Demande de paiement enregistrée.",
                    demande:
                        result.rows[0]
                },
                201
            );
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible d'enregistrer la demande de paiement.",
                500
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
                        u.domaine AS user_domaine
                    FROM demandes_paiement d
                    LEFT JOIN users u
                        ON u.id = d.user_id
                    ORDER BY d.id DESC
                    `
                );

            return success(res, {
                demandes:
                    result.rows,
                requests:
                    result.rows,
                total:
                    result.rows.length
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de récupérer les demandes.",
                500
            );
        }
    }
);

// ============================================================
// VALIDATION DEMANDE PAIEMENT
// ============================================================

app.patch(
    "/api/demandes-paiement/:id/valider",
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
                    "ID demande invalide."
                );
            }

            await client.query(
                "BEGIN"
            );

            const demandResult =
                await client.query(
                    `
                    SELECT *
                    FROM demandes_paiement
                    WHERE id = $1
                    FOR UPDATE
                    `,
                    [id]
                );

            if (
                demandResult.rows.length ===
                0
            ) {
                await client.query(
                    "ROLLBACK"
                );

                return failure(
                    res,
                    "Demande introuvable.",
                    404
                );
            }

            const demande =
                demandResult.rows[0];

            const days =
                Math.max(
                    1,
                    Math.floor(
                        safeNumber(
                            req.body?.premium_days ??
                                demande.premium_days,
                            30
                        )
                    )
                );

            const userId =
                parseId(
                    demande.user_id
                );

            let activatedUser =
                null;

            if (userId) {
                activatedUser =
                    await activatePremiumForUser(
                        client,
                        userId,
                        days
                    );
            }

            const updated =
                await client.query(
                    `
                    UPDATE demandes_paiement
                    SET
                        status = 'validated',
                        premium_days = $1,
                        validated_at = NOW(),
                        refused_at = NULL,
                        refusal_reason = NULL,
                        updated_at = NOW()
                    WHERE id = $2
                    RETURNING *
                    `,
                    [
                        days,
                        id
                    ]
                );

            await client.query(
                "COMMIT"
            );

            await logActivity({
                action:
                    "VALIDATE_PAYMENT_REQUEST",
                details:
                    `Demande de paiement ${id} validée`,
                userId,
                ip:
                    req.headers[
                        "x-forwarded-for"
                    ] ||
                    req.socket
                        .remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    "Demande validée avec succès.",
                demande:
                    updated.rows[0],
                user:
                    activatedUser,
                utilisateur:
                    activatedUser
            });
        } catch (error) {
            try {
                await client.query(
                    "ROLLBACK"
                );
            } catch {}

            console.error(error);

            return failure(
                res,
                "Impossible de valider la demande.",
                500
            );
        } finally {
            client.release();
        }
    }
);

// ============================================================
// REFUS DEMANDE PAIEMENT
// ============================================================

app.patch(
    "/api/demandes-paiement/:id/refuser",
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
                    "ID demande invalide."
                );
            }

            const reason =
                cleanString(
                    req.body?.reason ||
                        req.body?.refusal_reason ||
                        "Demande refusée par l'administration.",
                    5000
                );

            const result =
                await pool.query(
                    `
                    UPDATE demandes_paiement
                    SET
                        status = 'refused',
                        refused_at = NOW(),
                        refusal_reason = $1,
                        updated_at = NOW()
                    WHERE id = $2
                    RETURNING *
                    `,
                    [
                        reason,
                        id
                    ]
                );

            if (
                result.rows.length === 0
            ) {
                return failure(
                    res,
                    "Demande introuvable.",
                    404
                );
            }

            await logActivity({
                action:
                    "REFUSE_PAYMENT_REQUEST",
                details:
                    `Demande ${id} refusée : ${reason}`,
                userId:
                    result.rows[0]
                        .user_id,
                ip:
                    req.headers[
                        "x-forwarded-for"
                    ] ||
                    req.socket
                        .remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    "Demande refusée.",
                demande:
                    result.rows[0]
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de refuser la demande.",
                500
            );
        }
    }
);

// ============================================================
// PROGRESSION — MODIFICATION
// ============================================================

app.patch(
    "/api/admin/users/:id/progression",
    adminAuth,
    async (req, res) => {
        try {
            const userId =
                parseId(
                    req.params.id
                );

            if (!userId) {
                return failure(
                    res,
                    "ID utilisateur invalide."
                );
            }

            const body =
                req.body || {};

            const domaine =
                cleanString(
                    body.domaine ||
                        body.domain,
                    255
                );

            if (!domaine) {
                return failure(
                    res,
                    "Le domaine est obligatoire."
                );
            }

            const progression =
                clamp(
                    safeNumber(
                        body.progression,
                        0
                    ),
                    0,
                    100
                );

            const lessonsCompleted =
                Math.max(
                    0,
                    Math.floor(
                        safeNumber(
                            body.lessons_completed,
                            0
                        )
                    )
                );

            const totalLessons =
                Math.max(
                    0,
                    Math.floor(
                        safeNumber(
                            body.total_lessons,
                            0
                        )
                    )
                );

            const lastLesson =
                cleanString(
                    body.last_lesson,
                    500
                );

            const lastLessonTitle =
                cleanString(
                    body.last_lesson_title,
                    1000
                );

            const completed =
                toBoolean(
                    body.completed
                ) ||
                progression >= 100;

            const result =
                await pool.query(
                    `
                    INSERT INTO course_progress
                    (
                        user_id,
                        domaine,
                        progression,
                        lessons_completed,
                        total_lessons,
                        last_lesson,
                        last_lesson_title,
                        completed,
                        started_at,
                        completed_at,
                        updated_at
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        NOW(),
                        CASE
                            WHEN $8 = TRUE
                            THEN NOW()
                            ELSE NULL
                        END,
                        NOW()
                    )
                    ON CONFLICT
                    (
                        user_id,
                        domaine
                    )
                    DO UPDATE SET
                        progression =
                            EXCLUDED.progression,
                        lessons_completed =
                            EXCLUDED.lessons_completed,
                        total_lessons =
                            EXCLUDED.total_lessons,
                        last_lesson =
                            EXCLUDED.last_lesson,
                        last_lesson_title =
                            EXCLUDED.last_lesson_title,
                        completed =
                            EXCLUDED.completed,
                        completed_at =
                            CASE
                                WHEN EXCLUDED.completed = TRUE
                                THEN COALESCE(
                                    course_progress.completed_at,
                                    NOW()
                                )
                                ELSE NULL
                            END,
                        updated_at =
                            NOW()
                    RETURNING *
                    `,
                    [
                        userId,
                        domaine,
                        progression,
                        lessonsCompleted,
                        totalLessons,
                        lastLesson,
                        lastLessonTitle,
                        completed
                    ]
                );

            await logActivity({
                action:
                    "UPDATE_PROGRESS",
                details:
                    `Progression ${domaine} mise à jour à ${progression}%`,
                userId,
                ip:
                    req.headers[
                        "x-forwarded-for"
                    ] ||
                    req.socket
                        .remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    "Progression mise à jour.",
                progression:
                    result.rows[0]
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de mettre à jour la progression.",
                500
            );
        }
    }
);

// ============================================================
// PROGRESSIONS UTILISATEUR
// ============================================================

app.get(
    "/api/admin/users/:id/progression",
    adminAuth,
    async (req, res) => {
        try {
            const userId =
                parseId(
                    req.params.id
                );

            if (!userId) {
                return failure(
                    res,
                    "ID utilisateur invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM course_progress
                    WHERE user_id = $1
                    ORDER BY domaine ASC
                    `,
                    [userId]
                );

            return success(res, {
                progressions:
                    result.rows,
                progression:
                    result.rows
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de récupérer la progression.",
                500
            );
        }
    }
);

// ============================================================
// TOUTES LES PROGRESSIONS
// ============================================================

app.get(
    "/api/admin/progressions",
    adminAuth,
    async (req, res) => {
        try {
            const result =
                await pool.query(
                    `
                    SELECT
                        cp.*,
                        u.nom,
                        u.email,
                        u.domaine AS user_domaine
                    FROM course_progress cp
                    LEFT JOIN users u
                        ON u.id = cp.user_id
                    ORDER BY cp.updated_at DESC
                    `
                );

            return success(res, {
                progressions:
                    result.rows,
                total:
                    result.rows.length
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de récupérer les progressions.",
                500
            );
        }
    }
);

// ============================================================
// ENVOYER MESSAGE A UN UTILISATEUR
// ============================================================

app.post(
    "/api/messages/send-user",
    adminAuth,
    async (req, res) => {
        try {
            const body =
                req.body || {};

            const userId =
                parseId(
                    body.user_id ||
                        body.userId ||
                        body.recipient_user_id
                );

            if (!userId) {
                return failure(
                    res,
                    "Utilisateur destinataire invalide."
                );
            }

            const userResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        nom,
                        email
                    FROM users
                    WHERE id = $1
                    `,
                    [userId]
                );

            if (
                userResult.rows.length ===
                0
            ) {
                return failure(
                    res,
                    "Utilisateur destinataire introuvable.",
                    404
                );
            }

            const user =
                userResult.rows[0];

            const subject =
                cleanString(
                    body.subject ||
                        "Message BMJ SERVICE",
                    500
                );

            const content =
                cleanString(
                    body.content ||
                        body.message,
                    20000
                );

            if (!content) {
                return failure(
                    res,
                    "Le contenu du message est obligatoire."
                );
            }

            const priority =
                cleanString(
                    body.priority ||
                        "normal",
                    50
                );

            const type =
                cleanString(
                    body.type ||
                        "standard",
                    50
                );

            const result =
                await pool.query(
                    `
                    INSERT INTO messages
                    (
                        sender_type,
                        sender_user_id,
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
                        status,
                        created_at,
                        updated_at
                    )
                    VALUES
                    (
                        'admin',
                        NULL,
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9,
                        'user',
                        'unread',
                        NOW(),
                        NOW()
                    )
                    RETURNING *
                    `,
                    [
                        "BMJ SERVICE",
                        req.adminEmail,
                        user.id,
                        user.nom,
                        user.email,
                        subject,
                        content,
                        type,
                        priority
                    ]
                );

            await logActivity({
                action:
                    "SEND_MESSAGE",
                details:
                    `Message envoyé à ${user.email}`,
                userId,
                ip:
                    req.headers[
                        "x-forwarded-for"
                    ] ||
                    req.socket
                        .remoteAddress ||
                    ""
            });

            return success(
                res,
                {
                    message:
                        "Message envoyé avec succès.",
                    data:
                        result.rows[0],
                    messageData:
                        result.rows[0]
                },
                201
            );
        } catch (error) {
            console.error(
                "Erreur envoi message :",
                error
            );

            return failure(
                res,
                "Impossible d'envoyer le message.",
                500
            );
        }
    }
);

// ============================================================
// REPONSE ADMIN
// ============================================================

app.post(
    "/api/admin/messages/reply",
    adminAuth,
    async (req, res) => {
        try {
            const body =
                req.body || {};

            const userId =
                parseId(
                    body.user_id ||
                        body.userId ||
                        body.recipient_user_id
                );

            if (!userId) {
                return failure(
                    res,
                    "Destinataire invalide."
                );
            }

            const userResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        nom,
                        email
                    FROM users
                    WHERE id = $1
                    `,
                    [userId]
                );

            if (
                userResult.rows.length ===
                0
            ) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            const user =
                userResult.rows[0];

            const content =
                cleanString(
                    body.content ||
                        body.message,
                    20000
                );

            if (!content) {
                return failure(
                    res,
                    "Le contenu du message est obligatoire."
                );
            }

            const subject =
                cleanString(
                    body.subject ||
                        "Réponse BMJ SERVICE",
                    500
                );

            const result =
                await pool.query(
                    `
                    INSERT INTO messages
                    (
                        sender_type,
                        sender_user_id,
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
                        status,
                        created_at,
                        updated_at
                    )
                    VALUES
                    (
                        'admin',
                        NULL,
                        'BMJ SERVICE',
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        'reply',
                        'normal',
                        'user',
                        'unread',
                        NOW(),
                        NOW()
                    )
                    RETURNING *
                    `,
                    [
                        req.adminEmail,
                        user.id,
                        user.nom,
                        user.email,
                        subject,
                        content
                    ]
                );

            return success(
                res,
                {
                    message:
                        "Réponse envoyée.",
                    data:
                        result.rows[0]
                },
                201
            );
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible d'envoyer la réponse.",
                500
            );
        }
    }
);

// ============================================================
// MESSAGES D'UN UTILISATEUR
// ============================================================

app.get(
    "/api/admin/users/:id/messages",
    adminAuth,
    async (req, res) => {
        try {
            const userId =
                parseId(
                    req.params.id
                );

            if (!userId) {
                return failure(
                    res,
                    "ID utilisateur invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM messages
                    WHERE
                        sender_user_id = $1
                        OR recipient_user_id = $1
                    ORDER BY created_at ASC
                    `,
                    [userId]
                );

            return success(res, {
                messages:
                    result.rows,
                total:
                    result.rows.length
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de récupérer les messages.",
                500
            );
        }
    }
);

// ============================================================
// TOUS LES MESSAGES
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

            return success(res, {
                messages:
                    result.rows,
                total:
                    result.rows.length
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de récupérer les messages.",
                500
            );
        }
    }
);

// ============================================================
// MARQUER MESSAGE COMME LU
// ============================================================

app.patch(
    "/api/utilisateurs/:userId/messages/:messageId/read",
    adminAuth,
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

            if (
                !userId ||
                !messageId
            ) {
                return failure(
                    res,
                    "Identifiants invalides."
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
                    WHERE
                        id = $1
                        AND recipient_user_id = $2
                    RETURNING *
                    `,
                    [
                        messageId,
                        userId
                    ]
                );

            if (
                result.rows.length ===
                0
            ) {
                return failure(
                    res,
                    "Message introuvable.",
                    404
                );
            }

            return success(res, {
                message:
                    "Message marqué comme lu.",
                data:
                    result.rows[0]
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de modifier le message.",
                500
            );
        }
    }
);

// ============================================================
// STATISTIQUES
// ============================================================

async function getStatistics() {
    const result =
        await pool.query(`
            SELECT

                (
                    SELECT COUNT(*)
                    FROM users
                )::INTEGER AS utilisateurs,

                (
                    SELECT COUNT(*)
                    FROM users
                    WHERE
                        (
                            premium = TRUE
                            OR is_premium = TRUE
                        )
                        AND
                        (
                            premium_until IS NULL
                            OR premium_until > NOW()
                        )
                )::INTEGER AS premium,

                (
                    SELECT COUNT(*)
                    FROM users
                    WHERE
                        blocked = TRUE
                        OR is_blocked = TRUE
                )::INTEGER AS bloques,

                (
                    SELECT COUNT(*)
                    FROM paiements
                )::INTEGER AS paiements_total,

                (
                    SELECT COUNT(*)
                    FROM paiements
                    WHERE LOWER(
                        COALESCE(
                            status,
                            'pending'
                        )
                    ) = 'pending'
                )::INTEGER AS paiements_pending,

                (
                    SELECT COUNT(*)
                    FROM paiements
                    WHERE LOWER(
                        COALESCE(
                            status,
                            ''
                        )
                    ) = 'validated'
                )::INTEGER AS paiements_validated,

                (
                    SELECT COUNT(*)
                    FROM paiements
                    WHERE LOWER(
                        COALESCE(
                            status,
                            ''
                        )
                    ) = 'refused'
                )::INTEGER AS paiements_refused,

                (
                    SELECT COALESCE(
                        SUM(
                            CASE
                                WHEN LOWER(
                                    COALESCE(
                                        status,
                                        ''
                                    )
                                ) = 'validated'
                                THEN COALESCE(
                                    amount,
                                    montant,
                                    0
                                )
                                ELSE 0
                            END
                        ),
                        0
                    )
                    FROM paiements
                )::NUMERIC(12,2) AS revenus,

                (
                    SELECT COUNT(*)
                    FROM demandes_paiement
                )::INTEGER AS demandes_total,

                (
                    SELECT COUNT(*)
                    FROM demandes_paiement
                    WHERE LOWER(
                        COALESCE(
                            status,
                            'pending'
                        )
                    ) = 'pending'
                )::INTEGER AS demandes_pending,

                (
                    SELECT COUNT(*)
                    FROM demandes_paiement
                    WHERE LOWER(
                        COALESCE(
                            status,
                            ''
                        )
                    ) = 'validated'
                )::INTEGER AS demandes_validated,

                (
                    SELECT COUNT(*)
                    FROM demandes_paiement
                    WHERE LOWER(
                        COALESCE(
                            status,
                            ''
                        )
                    ) = 'refused'
                )::INTEGER AS demandes_refused,

                (
                    SELECT COUNT(*)
                    FROM messages
                )::INTEGER AS messages_total,

                (
                    SELECT COUNT(*)
                    FROM messages
                    WHERE LOWER(
                        COALESCE(
                            status,
                            'unread'
                        )
                    ) <> 'read'
                )::INTEGER AS messages_unread,

                (
                    SELECT COUNT(*)
                    FROM course_progress
                )::INTEGER AS progression_total,

                (
                    SELECT COUNT(*)
                    FROM course_progress
                    WHERE completed = TRUE
                )::INTEGER AS progression_completed,

                (
                    SELECT COALESCE(
                        AVG(progression),
                        0
                    )
                    FROM course_progress
                )::NUMERIC(6,2) AS progression_average
        `);

    const row =
        result.rows[0];

    const total =
        Number(
            row.utilisateurs
        ) || 0;

    const premium =
        Number(
            row.premium
        ) || 0;

    const blocked =
        Number(
            row.bloques
        ) || 0;

    return {
        utilisateurs:
            total,

        total_users:
            total,

        premium,

        premium_users:
            premium,

        bloques:
            blocked,

        blocked_users:
            blocked,

        standard:
            Math.max(
                0,
                total - premium
            ),

        paiements: {
            total:
                Number(
                    row.paiements_total
                ) || 0,

            pending:
                Number(
                    row.paiements_pending
                ) || 0,

            validated:
                Number(
                    row.paiements_validated
                ) || 0,

            refused:
                Number(
                    row.paiements_refused
                ) || 0,

            revenues:
                Number(
                    row.revenus
                ) || 0
        },

        demandes: {
            total:
                Number(
                    row.demandes_total
                ) || 0,

            pending:
                Number(
                    row.demandes_pending
                ) || 0,

            validated:
                Number(
                    row.demandes_validated
                ) || 0,

            refused:
                Number(
                    row.demandes_refused
                ) || 0
        },

        messages: {
            total:
                Number(
                    row.messages_total
                ) || 0,

            unread:
                Number(
                    row.messages_unread
                ) || 0
        },

        progression: {
            total:
                Number(
                    row.progression_total
                ) || 0,

            completed:
                Number(
                    row.progression_completed
                ) || 0,

            average:
                Number(
                    row.progression_average
                ) || 0
        }
    };
}

// ============================================================
// STATISTIQUES ADMIN
// ============================================================

app.get(
    "/api/admin/statistiques",
    adminAuth,
    async (req, res) => {
        try {
            const statistiques =
                await getStatistics();

            return success(res, {
                statistiques,
                statistics:
                    statistiques,
                data:
                    statistiques
            });
        } catch (error) {
            console.error(
                "Erreur statistiques :",
                error
            );

            return failure(
                res,
                "Impossible de récupérer les statistiques.",
                500
            );
        }
    }
);

// ============================================================
// STATISTIQUES PUBLIQUES
// ============================================================

app.get(
    "/api/statistiques",
    async (req, res) => {
        try {
            const statistiques =
                await getStatistics();

            return success(res, {
                statistiques,
                statistics:
                    statistiques
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de récupérer les statistiques.",
                500
            );
        }
    }
);

// ============================================================
// ACTIVITES ADMIN
// ============================================================

app.get(
    "/api/admin/activites",
    adminAuth,
    async (req, res) => {
        try {
            const limitRaw =
                Number(
                    req.query.limit ||
                        100
                );

            const limit =
                Math.min(
                    Math.max(
                        Number.isFinite(
                            limitRaw
                        )
                            ? Math.floor(
                                  limitRaw
                              )
                            : 100,
                        1
                    ),
                    500
                );

            const result =
                await pool.query(
                    `
                    SELECT
                        aa.*,
                        u.nom AS user_nom,
                        u.email AS user_email
                    FROM admin_activity aa
                    LEFT JOIN users u
                        ON u.id = aa.user_id
                    ORDER BY aa.created_at DESC
                    LIMIT $1
                    `,
                    [limit]
                );

            return success(res, {
                activites:
                    result.rows,
                activities:
                    result.rows,
                total:
                    result.rows.length
            });
        } catch (error) {
            console.error(error);

            return failure(
                res,
                "Impossible de récupérer les activités.",
                500
            );
        }
    }
);

// ============================================================
// ROUTE 404
// ============================================================

app.use(
    (req, res) => {
        return res.status(404).json({
            success: false,
            message:
                "Route API introuvable.",
            error:
                "ROUTE_NOT_FOUND",
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
            "ERREUR SERVEUR :",
            error
        );

        if (
            res.headersSent
        ) {
            return next(error);
        }

        return res
            .status(500)
            .json({
                success: false,
                message:
                    "Une erreur interne du serveur est survenue.",
                error:
                    "INTERNAL_SERVER_ERROR"
            });
    }
);

// ============================================================
// DEMARRAGE SERVEUR
// ============================================================

async function startServer() {
    try {
        await initDatabase();

        await pool.query(
            "SELECT 1"
        );

        app.listen(
            PORT,
            "0.0.0.0",
            () => {
                console.log("");
                console.log(
                    "============================================================"
                );
                console.log(
                    "BMJ SERVICE — SERVEUR DEMARRE"
                );
                console.log(
                    "============================================================"
                );
                console.log(
                    `Port : ${PORT}`
                );
                console.log(
                    `URL locale : http://localhost:${PORT}`
                );
                console.log(
                    "PostgreSQL : CONNECTÉ"
                );
                console.log(
                    "Données existantes : CONSERVÉES"
                );
                console.log(
                    "Seed DEMO : ACTIF"
                );
                console.log(
                    "Route utilisateurs : /api/admin/users"
                );
                console.log(
                    "============================================================"
                );
                console.log("");
            }
        );
    } catch (error) {
        console.error("");
        console.error(
            "============================================================"
        );
        console.error(
            "IMPOSSIBLE DE DEMARRER BMJ SERVICE"
        );
        console.error(
            "============================================================"
        );
        console.error(
            error.message
        );
        console.error(
            "============================================================"
        );

        process.exit(1);
    }
}

// ============================================================
// ARRET PROPRE
// ============================================================

async function gracefulShutdown(
    signal
) {
    console.log(
        `${signal} reçu. Arrêt propre du serveur...`
    );

    try {
        await pool.end();

        console.log(
            "Connexion PostgreSQL fermée."
        );

        process.exit(0);
    } catch (error) {
        console.error(
            "Erreur pendant l'arrêt :",
            error
        );

        process.exit(1);
    }
}

process.on(
    "SIGTERM",
    () =>
        gracefulShutdown(
            "SIGTERM"
        )
);

process.on(
    "SIGINT",
    () =>
        gracefulShutdown(
            "SIGINT"
        )
);

process.on(
    "unhandledRejection",
    (error) => {
        console.error(
            "Unhandled Promise Rejection :",
            error
        );
    }
);

process.on(
    "uncaughtException",
    (error) => {
        console.error(
            "Uncaught Exception :",
            error
        );
    }
);

// ============================================================
// LANCEMENT
// ============================================================

startServer();