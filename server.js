
// ============================================================
// BMJ SERVICE — BACKEND COMPLET
// Node.js + Express + PostgreSQL
// ============================================================
//
// IMPORTANT :
// - Ce serveur NE SUPPRIME PAS les anciennes données.
// - Aucun DROP TABLE.
// - Aucun TRUNCATE.
// - Aucun DELETE global.
// - Les tables existantes sont conservées.
// - Les colonnes manquantes sont ajoutées avec ALTER TABLE.
// - Les utilisateurs de démonstration sont ajoutés uniquement
//   s'ils n'existent pas déjà.
//
// Déploiement recommandé : Render
// Base de données : PostgreSQL
// ============================================================

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const crypto = require("crypto");

// ============================================================
// CONFIGURATION
// ============================================================

const app = express();

const PORT = Number(process.env.PORT) || 10000;

// IMPORTANT :
// Conserver dans Render la même DATABASE_URL que celle de
// votre base PostgreSQL actuelle.
// Ne pas remplacer la base existante par une nouvelle base.
//
// Vous pouvez également mettre la DATABASE_URL directement
// dans cette variable si vous travaillez en local, mais il est
// fortement recommandé d'utiliser la variable Render.
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://name_bmj_db_user:TjgoLRbYV0LizRgBFD1nepGqSqErgBgD@dpg-dagn0e15efls73b8rjh0-a/name_bmj_db";

const ADMIN_EMAIL =
    process.env.ADMIN_EMAIL || "admin@bmjservice.com";

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "BMJAdmin@2026";

const ADMIN_SECRET =
    process.env.ADMIN_SECRET || "BMJ_SERVICE_ADMIN_SECRET_2026_CHANGE_ME";

const JUSTIN_ADMIN_NAME =
    process.env.JUSTIN_ADMIN_NAME || "MUSSIWA JUSTIN";

const JUSTIN_ADMIN_EMAIL =
    process.env.JUSTIN_ADMIN_EMAIL || "mussiwajustin@gmail.com";

const JUSTIN_ADMIN_PASSWORD =
    process.env.JUSTIN_ADMIN_PASSWORD || "Justin_BMJ_2026!";

const TOKEN_DURATION_SECONDS = 24 * 60 * 60;

// ============================================================
// VERIFICATION DATABASE
// ============================================================

if (!DATABASE_URL) {
    console.error("");
    console.error("============================================================");
    console.error("ERREUR : DATABASE_URL est absente.");
    console.error("============================================================");
    console.error(
        "Ajoutez dans Render > Environment la DATABASE_URL de votre base PostgreSQL existante."
    );
    console.error("");
}

// ============================================================
// UTILISATEURS DE DEMONSTRATION
// ============================================================
//
// Ces utilisateurs seront AJOUTÉS seulement s'ils n'existent
// pas déjà.
//
// Si un utilisateur existe déjà :
// - son mot de passe est conservé
// - son Premium est conservé
// - son blocage est conservé
// - son certificat est conservé
// - sa progression est conservée
// - ses autres données sont conservées
//
// ============================================================

const DEMO_USERS = [
    {
        nom: "Jean Patrick Kabeya",
        email: "jean.kabeya@bmjservice.com",
        telephone: "+243810000001",
        pays: "RDC",
        ville: "Lubumbashi",
        domaine: "Leadership",
        niveau: "Débutant",
        photo: ""
    },
    {
        nom: "Grâce Mbuyi",
        email: "grace.mbuyi@bmjservice.com",
        telephone: "+243810000002",
        pays: "RDC",
        ville: "Kinshasa",
        domaine: "Marketing Digital",
        niveau: "Débutant",
        photo: ""
    },
    {
        nom: "David Ilunga",
        email: "david.ilunga@bmjservice.com",
        telephone: "+243810000003",
        pays: "RDC",
        ville: "Lubumbashi",
        domaine: "Finance",
        niveau: "Intermédiaire",
        photo: ""
    },
    {
        nom: "Sarah Kasongo",
        email: "sarah.kasongo@bmjservice.com",
        telephone: "+243810000004",
        pays: "RDC",
        ville: "Kolwezi",
        domaine: "Beauté et Esthétique",
        niveau: "Débutant",
        photo: ""
    },
    {
        nom: "Patrick Tshibanda",
        email: "patrick.tshibanda@bmjservice.com",
        telephone: "+243810000005",
        pays: "RDC",
        ville: "Lubumbashi",
        domaine: "Entrepreneuriat",
        niveau: "Intermédiaire",
        photo: ""
    },
    {
        nom: "Esther Mukendi",
        email: "esther.mukendi@bmjservice.com",
        telephone: "+243810000006",
        pays: "RDC",
        ville: "Kinshasa",
        domaine: "Leadership",
        niveau: "Débutant",
        photo: ""
    },
    {
        nom: "Jonathan Kalala",
        email: "jonathan.kalala@bmjservice.com",
        telephone: "+243810000007",
        pays: "RDC",
        ville: "Lubumbashi",
        domaine: "Technologie et Industrialisation",
        niveau: "Intermédiaire",
        photo: ""
    },
    {
        nom: "Merveille Banza",
        email: "merveille.banza@bmjservice.com",
        telephone: "+243810000008",
        pays: "RDC",
        ville: "Likasi",
        domaine: "Marketing Digital",
        niveau: "Débutant",
        photo: ""
    },
    {
        nom: "Daniel Mwamba",
        email: "daniel.mwamba@bmjservice.com",
        telephone: "+243810000009",
        pays: "RDC",
        ville: "Lubumbashi",
        domaine: "Finance",
        niveau: "Intermédiaire",
        photo: ""
    },
    {
        nom: "Ruth Kabongo",
        email: "ruth.kabongo@bmjservice.com",
        telephone: "+243810000010",
        pays: "RDC",
        ville: "Kinshasa",
        domaine: "Organisation d'Évènements",
        niveau: "Débutant",
        photo: ""
    },
    {
        nom: "Michel Mutombo",
        email: "michel.mutombo@bmjservice.com",
        telephone: "+243810000011",
        pays: "RDC",
        ville: "Lubumbashi",
        domaine: "Entrepreneuriat",
        niveau: "Intermédiaire",
        photo: ""
    },
    {
        nom: "Naomie Kalambayi",
        email: "naomie.kalambayi@bmjservice.com",
        telephone: "+243810000012",
        pays: "RDC",
        ville: "Kolwezi",
        domaine: "Beauté et Esthétique",
        niveau: "Débutant",
        photo: ""
    },
    {
        nom: "Kevin Lufungula",
        email: "kevin.lufungula@bmjservice.com",
        telephone: "+243810000013",
        pays: "RDC",
        ville: "Lubumbashi",
        domaine: "Technologie et Industrialisation",
        niveau: "Débutant",
        photo: ""
    },
    {
        nom: "Prisca Ilunga",
        email: "prisca.ilunga@bmjservice.com",
        telephone: "+243810000014",
        pays: "RDC",
        ville: "Kinshasa",
        domaine: "Marketing Digital",
        niveau: "Intermédiaire",
        photo: ""
    },
    {
        nom: "Christian Kabila",
        email: "christian.kabila@bmjservice.com",
        telephone: "+243810000015",
        pays: "RDC",
        ville: "Lubumbashi",
        domaine: "Leadership",
        niveau: "Intermédiaire",
        photo: ""
    },
    {
        nom: "Béatrice Kalonji",
        email: "beatrice.kalonji@bmjservice.com",
        telephone: "+243810000016",
        pays: "RDC",
        ville: "Likasi",
        domaine: "Finance",
        niveau: "Débutant",
        photo: ""
    },
    {
        nom: "Fabrice Mumba",
        email: "fabrice.mumba@bmjservice.com",
        telephone: "+243810000017",
        pays: "RDC",
        ville: "Lubumbashi",
        domaine: "Entrepreneuriat",
        niveau: "Intermédiaire",
        photo: ""
    },
    {
        nom: "Grâce Tshisekedi",
        email: "grace.tshisekedi@bmjservice.com",
        telephone: "+243810000018",
        pays: "RDC",
        ville: "Kinshasa",
        domaine: "Organisation d'Évènements",
        niveau: "Débutant",
        photo: ""
    },
    {
        nom: "Alexis Kabeya",
        email: "alexis.kabeya@bmjservice.com",
        telephone: "+243810000019",
        pays: "RDC",
        ville: "Lubumbashi",
        domaine: "Technologie et Industrialisation",
        niveau: "Intermédiaire",
        photo: ""
    },
    {
        nom: "Rachel Mwape",
        email: "rachel.mwape@bmjservice.com",
        telephone: "+243810000020",
        pays: "RDC",
        ville: "Kolwezi",
        domaine: "Marketing Digital",
        niveau: "Débutant",
        photo: ""
    },
    {
        nom: "Samuel Kanku",
        email: "samuel.kanku@bmjservice.com",
        telephone: "+243810000021",
        pays: "RDC",
        ville: "Lubumbashi",
        domaine: "Finance",
        niveau: "Intermédiaire",
        photo: ""
    },
    {
        nom: "Emilienne Kasongo",
        email: "emilienne.kasongo@bmjservice.com",
        telephone: "+243810000022",
        pays: "RDC",
        ville: "Kinshasa",
        domaine: "Beauté et Esthétique",
        niveau: "Débutant",
        photo: ""
    },
    {
        nom: "Moïse Mukendi",
        email: "moise.mukendi@bmjservice.com",
        telephone: "+243810000023",
        pays: "RDC",
        ville: "Lubumbashi",
        domaine: "Leadership",
        niveau: "Intermédiaire",
        photo: ""
    },
    {
        nom: "Estelle Mbuyi",
        email: "estelle.mbuyi@bmjservice.com",
        telephone: "+243810000024",
        pays: "RDC",
        ville: "Likasi",
        domaine: "Entrepreneuriat",
        niveau: "Débutant",
        photo: ""
    },
    {
        nom: "Joseph Mulamba",
        email: "joseph.mulamba@bmjservice.com",
        telephone: "+243810000025",
        pays: "RDC",
        ville: "Lubumbashi",
        domaine: "Technologie et Industrialisation",
        niveau: "Intermédiaire",
        photo: ""
    },
    {
        nom: "Chantal Kabongo",
        email: "chantal.kabongo@bmjservice.com",
        telephone: "+243810000026",
        pays: "RDC",
        ville: "Kinshasa",
        domaine: "Marketing Digital",
        niveau: "Débutant",
        photo: ""
    },
    {
        nom: "André Kalala",
        email: "andre.kalala@bmjservice.com",
        telephone: "+243810000027",
        pays: "RDC",
        ville: "Lubumbashi",
        domaine: "Finance",
        niveau: "Intermédiaire",
        photo: ""
    },
    {
        nom: "Solange Mumba",
        email: "solange.mumba@bmjservice.com",
        telephone: "+243810000028",
        pays: "RDC",
        ville: "Kolwezi",
        domaine: "Organisation d'Évènements",
        niveau: "Débutant",
        photo: ""
    },
    {
        nom: "Didier Tshomba",
        email: "didier.tshomba@bmjservice.com",
        telephone: "+243810000029",
        pays: "RDC",
        ville: "Lubumbashi",
        domaine: "Leadership",
        niveau: "Intermédiaire",
        photo: ""
    },
    {
        nom: "Emmanuelle Banza",
        email: "emmanuelle.banza@bmjservice.com",
        telephone: "+243810000030",
        pays: "RDC",
        ville: "Kinshasa",
        domaine: "Entrepreneuriat",
        niveau: "Débutant",
        photo: ""
    }
];

// ============================================================
// CONNEXION POSTGRESQL
// ============================================================

const pool = new Pool({
    connectionString: DATABASE_URL || undefined,

    ssl: DATABASE_URL
        ? {
              rejectUnauthorized: false
          }
        : undefined,

    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

pool.on("error", (error) => {
    console.error("Erreur PostgreSQL inattendue :", error);
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
        const duration = Date.now() - started;

        console.log(
            `${new Date().toISOString()} | ${req.method} ${req.originalUrl} | ${res.statusCode} | ${duration}ms`
        );
    });

    next();
});

// ============================================================
// OUTILS
// ============================================================

function cleanString(value, maxLength = 10000) {
    if (value === undefined || value === null) {
        return "";
    }

    return String(value)
        .trim()
        .slice(0, maxLength);
}

function normalizeEmail(email) {
    return cleanString(email, 320).toLowerCase();
}

function parseId(value) {
    const id = Number.parseInt(value, 10);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
}

function toBoolean(value) {
    return (
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true" ||
        value === "TRUE" ||
        value === "on"
    );
}

function success(res, data = {}, status = 200) {
    return res.status(status).json({
        success: true,
        ...data
    });
}

function failure(res, message, status = 400, extra = {}) {
    return res.status(status).json({
        success: false,
        message,
        error: message,
        ...extra
    });
}

function safeNumber(value, fallback = 0) {
    const n = Number(value);

    return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// ============================================================
// MOTS DE PASSE
// ============================================================

function hashPassword(password) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString("hex");

        crypto.scrypt(
            String(password),
            salt,
            64,
            {
                N: 16384,
                r: 8,
                p: 1
            },
            (error, derivedKey) => {
                if (error) {
                    return reject(error);
                }

                resolve(
                    `scrypt:${salt}:${derivedKey.toString("hex")}`
                );
            }
        );
    });
}

function verifyPassword(password, storedPassword) {
    return new Promise((resolve) => {
        try {
            if (
                !storedPassword ||
                typeof storedPassword !== "string"
            ) {
                return resolve(false);
            }

            if (!storedPassword.startsWith("scrypt:")) {
                return resolve(
                    String(password) === String(storedPassword)
                );
            }

            const parts = storedPassword.split(":");

            if (parts.length !== 3) {
                return resolve(false);
            }

            const salt = parts[1];
            const storedHex = parts[2];

            crypto.scrypt(
                String(password),
                salt,
                64,
                {
                    N: 16384,
                    r: 8,
                    p: 1
                },
                (error, derivedKey) => {
                    if (error) {
                        return resolve(false);
                    }

                    const storedBuffer =
                        Buffer.from(storedHex, "hex");

                    if (
                        storedBuffer.length !==
                        derivedKey.length
                    ) {
                        return resolve(false);
                    }

                    resolve(
                        crypto.timingSafeEqual(
                            storedBuffer,
                            derivedKey
                        )
                    );
                }
            );
        } catch (error) {
            resolve(false);
        }
    });
}

// ============================================================
// PREMIUM / BLOCAGE
// ============================================================

function isPremiumUser(user) {
    if (!user) {
        return false;
    }

    if (
        user.premium === true ||
        user.is_premium === true ||
        user.premium === 1 ||
        user.is_premium === 1
    ) {
        if (!user.premium_until) {
            return true;
        }

        const expiration =
            new Date(user.premium_until).getTime();

        if (!Number.isFinite(expiration)) {
            return true;
        }

        return expiration > Date.now();
    }

    return false;
}

function isBlockedUser(user) {
    if (!user) {
        return false;
    }

    return (
        user.blocked === true ||
        user.is_blocked === true ||
        user.blocked === 1 ||
        user.is_blocked === 1
    );
}

// ============================================================
// TOKEN ADMIN
// ============================================================

function createAdminToken(email) {
    const timestamp = Math.floor(Date.now() / 1000);

    const payload = `${normalizeEmail(email)}.${timestamp}`;

    const signature = crypto
        .createHmac("sha256", ADMIN_SECRET)
        .update(payload)
        .digest("hex");

    return Buffer.from(
        `${payload}.${signature}`
    ).toString("base64url");
}

function verifyAdminToken(token) {
    try {
        if (!token) {
            return false;
        }

        const decoded = Buffer.from(
            token,
            "base64url"
        ).toString("utf8");

        const parts = decoded.split(".");

        if (parts.length !== 3) {
            return false;
        }

        const email = parts[0];
        const timestamp = Number(parts[1]);
        const signature = parts[2];

        if (!email || !Number.isFinite(timestamp)) {
            return false;
        }

        const now = Math.floor(Date.now() / 1000);

        if (
            timestamp > now + 60 ||
            now - timestamp > TOKEN_DURATION_SECONDS
        ) {
            return false;
        }

        const payload = `${email}.${timestamp}`;

        const expected = crypto
            .createHmac("sha256", ADMIN_SECRET)
            .update(payload)
            .digest("hex");

        const a = Buffer.from(signature, "utf8");
        const b = Buffer.from(expected, "utf8");

        if (a.length !== b.length) {
            return false;
        }

        if (!crypto.timingSafeEqual(a, b)) {
            return false;
        }

        return {
            email,
            timestamp
        };
    } catch (error) {
        return false;
    }
}

// ============================================================
// AUTHENTIFICATION ADMIN
// ============================================================

function getAdminTokenFromRequest(req) {
    const authorization =
        req.headers.authorization || "";

    if (
        authorization &&
        authorization.toLowerCase().startsWith("bearer ")
    ) {
        return authorization.substring(7).trim();
    }

    const headerToken =
        req.headers["x-admin-token"];

    if (headerToken) {
        return String(headerToken).trim();
    }

    if (req.query && req.query.token) {
        return String(req.query.token).trim();
    }

    return "";
}

function adminAuth(req, res, next) {
    const token = getAdminTokenFromRequest(req);

    const result = verifyAdminToken(token);

    if (!result) {
        return failure(
            res,
            "Votre session administrateur n'est plus valide. Veuillez vous reconnecter.",
            401,
            {
                code: "ADMIN_AUTH_REQUIRED"
            }
        );
    }

    req.adminEmail = result.email;
    req.adminTokenTimestamp = result.timestamp;

    next();
}

// ============================================================
// JOURNAL ADMIN
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
            VALUES ($1, $2, $3, $4, NOW())
            `,
            [
                cleanString(action, 255),
                cleanString(details, 5000),
                userId ? parseId(userId) : null,
                cleanString(ip, 100)
            ]
        );
    } catch (error) {
        console.error(
            "Impossible d'enregistrer l'activité admin :",
            error.message
        );
    }
}

// ============================================================
// INITIALISATION / MIGRATIONS
// ============================================================

async function initDatabase() {
    console.log("");
    console.log("============================================================");
    console.log("BMJ SERVICE — INITIALISATION DE LA BASE");
    console.log("============================================================");

    if (!DATABASE_URL) {
        throw new Error(
            "DATABASE_URL est absente. Configurez la base PostgreSQL existante dans Render."
        );
    }

    const client = await pool.connect();

    try {
        await client.query("SELECT NOW()");

        console.log("Connexion PostgreSQL : OK");

        // ========================================================
        // TABLE USERS
        // ========================================================

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

        // ========================================================
        // MIGRATION USERS
        // ========================================================

        const userColumns = [
            ["nom", "TEXT"],
            ["email", "TEXT"],
            ["telephone", "TEXT"],
            ["domaine", "TEXT"],
            ["pays", "TEXT"],
            ["ville", "TEXT"],
            ["niveau", "TEXT"],
            ["password", "TEXT"],
            ["photo", "TEXT"],
            ["role", "TEXT DEFAULT 'user'"],
            ["premium", "BOOLEAN DEFAULT FALSE"],
            ["is_premium", "BOOLEAN DEFAULT FALSE"],
            ["premium_until", "TIMESTAMP NULL"],
            ["blocked", "BOOLEAN DEFAULT FALSE"],
            ["is_blocked", "BOOLEAN DEFAULT FALSE"],
            [
                "certificate_authorized",
                "BOOLEAN DEFAULT FALSE"
            ],
            [
                "certificate_authorized_at",
                "TIMESTAMP NULL"
            ],
            [
                "certificate_authorized_by",
                "TEXT"
            ],
            ["created_at", "TIMESTAMP DEFAULT NOW()"],
            ["updated_at", "TIMESTAMP DEFAULT NOW()"]
        ];

        for (const [column, definition] of userColumns) {
            await client.query(
                `ALTER TABLE users ADD COLUMN IF NOT EXISTS ${column} ${definition}`
            );
        }

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
            CREATE INDEX IF NOT EXISTS idx_users_created_at
            ON users (created_at DESC)
        `);

        // ========================================================
        // TABLE PAIEMENTS
        // ========================================================

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

        for (const [column, definition] of paymentColumns) {
            await client.query(
                `ALTER TABLE paiements ADD COLUMN IF NOT EXISTS ${column} ${definition}`
            );
        }

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_paiements_user
            ON paiements (user_id)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_paiements_status
            ON paiements (status)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_paiements_created
            ON paiements (created_at DESC)
        `);

        // ========================================================
        // TABLE DEMANDES PAIEMENT
        // ========================================================

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

        for (const [column, definition] of requestColumns) {
            await client.query(
                `ALTER TABLE demandes_paiement ADD COLUMN IF NOT EXISTS ${column} ${definition}`
            );
        }

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_demandes_user
            ON demandes_paiement (user_id)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_demandes_status
            ON demandes_paiement (status)
        `);

        // ========================================================
        // TABLE MESSAGES
        // ========================================================

        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                sender_type TEXT DEFAULT 'user',
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
                audience TEXT,
                status TEXT DEFAULT 'unread',
                read_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        const messageColumns = [
            ["sender_type", "TEXT DEFAULT 'user'"],
            ["sender_user_id", "INTEGER"],
            ["sender_name", "TEXT"],
            ["sender_email", "TEXT"],
            ["recipient_user_id", "INTEGER"],
            ["recipient_name", "TEXT"],
            ["recipient_email", "TEXT"],
            ["subject", "TEXT"],
            ["content", "TEXT"],
            ["type", "TEXT DEFAULT 'standard'"],
            ["priority", "TEXT DEFAULT 'normal'"],
            ["audience", "TEXT"],
            ["status", "TEXT DEFAULT 'unread'"],
            ["read_at", "TIMESTAMP NULL"],
            ["created_at", "TIMESTAMP DEFAULT NOW()"],
            ["updated_at", "TIMESTAMP DEFAULT NOW()"]
        ];

        for (const [column, definition] of messageColumns) {
            await client.query(
                `ALTER TABLE messages ADD COLUMN IF NOT EXISTS ${column} ${definition}`
            );
        }

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_messages_recipient
            ON messages (recipient_user_id)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_messages_sender
            ON messages (sender_user_id)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_messages_status
            ON messages (status)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_messages_created
            ON messages (created_at DESC)
        `);

        // ========================================================
        // TABLE COURSE PROGRESS
        // ========================================================

        await client.query(`
            CREATE TABLE IF NOT EXISTS course_progress (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                domaine TEXT NOT NULL,
                progression NUMERIC(5,2) DEFAULT 0,
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

        const progressColumns = [
            ["user_id", "INTEGER"],
            ["domaine", "TEXT"],
            ["progression", "NUMERIC(5,2) DEFAULT 0"],
            ["lessons_completed", "INTEGER DEFAULT 0"],
            ["total_lessons", "INTEGER DEFAULT 0"],
            ["last_lesson", "TEXT"],
            ["last_lesson_title", "TEXT"],
            ["completed", "BOOLEAN DEFAULT FALSE"],
            ["started_at", "TIMESTAMP DEFAULT NOW()"],
            ["completed_at", "TIMESTAMP NULL"],
            ["updated_at", "TIMESTAMP DEFAULT NOW()"]
        ];

        for (const [column, definition] of progressColumns) {
            await client.query(
                `ALTER TABLE course_progress ADD COLUMN IF NOT EXISTS ${column} ${definition}`
            );
        }

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_progress_user
            ON course_progress (user_id)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_progress_domaine
            ON course_progress (domaine)
        `);

        // ========================================================
        // TABLE ACTIVITES ADMIN
        // ========================================================

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

        const activityColumns = [
            ["action", "TEXT"],
            ["details", "TEXT"],
            ["user_id", "INTEGER"],
            ["ip", "TEXT"],
            ["created_at", "TIMESTAMP DEFAULT NOW()"]
        ];

        for (const [column, definition] of activityColumns) {
            await client.query(
                `ALTER TABLE admin_activity ADD COLUMN IF NOT EXISTS ${column} ${definition}`
            );
        }

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_admin_activity_created
            ON admin_activity (created_at DESC)
        `);

        // ========================================================
        // NORMALISATION DES VALEURS NULL
        // ========================================================

        await client.query(`
            UPDATE users
            SET
                premium = COALESCE(premium, FALSE),
                is_premium = COALESCE(is_premium, FALSE),
                blocked = COALESCE(blocked, FALSE),
                is_blocked = COALESCE(is_blocked, FALSE),
                certificate_authorized =
                    COALESCE(certificate_authorized, FALSE),
                role = COALESCE(NULLIF(role, ''), 'user'),
                updated_at = COALESCE(updated_at, NOW())
            WHERE
                premium IS NULL
                OR is_premium IS NULL
                OR blocked IS NULL
                OR is_blocked IS NULL
                OR certificate_authorized IS NULL
                OR role IS NULL
                OR role = ''
                OR updated_at IS NULL
        `);

        // ========================================================
        // COMPTE ADMIN JUSTIN
        // ========================================================
        //
        // On ne supprime jamais le compte existant.
        // S'il existe, on le conserve.
        // On s'assure simplement qu'il possède le rôle admin.
        //
        // ========================================================

        const justinResult = await client.query(
            `
            SELECT *
            FROM users
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
            `,
            [JUSTIN_ADMIN_EMAIL]
        );

        if (justinResult.rows.length === 0) {
            const hashedJustinPassword =
                await hashPassword(
                    JUSTIN_ADMIN_PASSWORD
                );

            await client.query(
                `
                INSERT INTO users
                (
                    nom,
                    email,
                    telephone,
                    pays,
                    ville,
                    domaine,
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
                    '',
                    'RDC',
                    'Lubumbashi',
                    'Administration',
                    'Administrateur',
                    $3,
                    '',
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
                    JUSTIN_ADMIN_EMAIL,
                    hashedJustinPassword
                ]
            );

            console.log(
                "Compte administrateur Justin créé."
            );
        } else {
            const existingJustin =
                justinResult.rows[0];

            await client.query(
                `
                UPDATE users
                SET
                    role = 'admin',
                    blocked = FALSE,
                    is_blocked = FALSE,
                    updated_at = NOW()
                WHERE id = $1
                `,
                [existingJustin.id]
            );

            // Si le mot de passe existant ne correspond pas
            // au mot de passe administrateur configuré,
            // on le remet à jour uniquement pour ce compte admin.
            const passwordCorrect =
                await verifyPassword(
                    JUSTIN_ADMIN_PASSWORD,
                    existingJustin.password
                );

            if (!passwordCorrect) {
                const newHash =
                    await hashPassword(
                        JUSTIN_ADMIN_PASSWORD
                    );

                await client.query(
                    `
                    UPDATE users
                    SET password = $1,
                        updated_at = NOW()
                    WHERE id = $2
                    `,
                    [
                        newHash,
                        existingJustin.id
                    ]
                );

                console.log(
                    "Mot de passe du compte administrateur Justin synchronisé."
                );
            }

            console.log(
                "Compte administrateur Justin existant conservé."
            );
        }

        // ========================================================
        // INSERTION DES 30 UTILISATEURS DEMO
        // ========================================================
        //
        // IMPORTANT :
        // Aucun utilisateur existant n'est écrasé.
        //
        // ========================================================

        let demoInserted = 0;
        let demoExisting = 0;

        const demoPasswordHash =
            await hashPassword("BMJUser@2026");

        for (const user of DEMO_USERS) {
            const existing = await client.query(
                `
                SELECT id
                FROM users
                WHERE LOWER(email) = LOWER($1)
                LIMIT 1
                `,
                [user.email]
            );

            if (existing.rows.length > 0) {
                demoExisting++;
                continue;
            }

            await client.query(
                `
                INSERT INTO users
                (
                    nom,
                    email,
                    telephone,
                    pays,
                    ville,
                    domaine,
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
                    user.nom,
                    user.email,
                    user.telephone,
                    user.pays,
                    user.ville,
                    user.domaine,
                    user.niveau,
                    demoPasswordHash,
                    user.photo || ""
                ]
            );

            demoInserted++;
        }

        console.log(
            `Utilisateurs DEMO ajoutés : ${demoInserted}`
        );

        console.log(
            `Utilisateurs DEMO déjà présents et conservés : ${demoExisting}`
        );

        // ========================================================
        // COMPTEURS FINAUX
        // ========================================================

        const countUsers = await client.query(
            `SELECT COUNT(*)::INTEGER AS total FROM users`
        );

        const countPayments = await client.query(
            `SELECT COUNT(*)::INTEGER AS total FROM paiements`
        );

        const countMessages = await client.query(
            `SELECT COUNT(*)::INTEGER AS total FROM messages`
        );

        console.log(
            `Nombre total d'utilisateurs : ${countUsers.rows[0].total}`
        );

        console.log(
            `Nombre total de paiements : ${countPayments.rows[0].total}`
        );

        console.log(
            `Nombre total de messages : ${countMessages.rows[0].total}`
        );

        console.log(
            "Base PostgreSQL initialisée sans suppression de données."
        );

        console.log("============================================================");
        console.log("");
    } finally {
        client.release();
    }
}

// ============================================================
// ROUTE RACINE
// ============================================================

app.get("/", async (req, res) => {
    return res.json({
        success: true,
        name: "BMJ SERVICE API",
        message: "BMJ SERVICE Backend API active",
        version: "14.0.0",
        database: DATABASE_URL
            ? "configured"
            : "not_configured",
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// API ROOT
// ============================================================

app.get("/api", async (req, res) => {
    return res.json({
        success: true,
        name: "BMJ SERVICE API",
        version: "14.0.0",
        message: "API BMJ SERVICE active",
        routes: {
            inscription: "POST /api/inscription",
            connexion: "POST /api/connexion",
            adminLogin: "POST /api/admin/login",
            utilisateurs: "GET /api/utilisateurs",
            paiements: "GET /api/paiements",
            demandes: "GET /api/demandes-paiement",
            messages: "GET /api/messages",
            statistiques: "GET /api/admin/statistiques",
            progressions: "GET /api/admin/progressions"
        }
    });
});

// ============================================================
// HEALTH
// ============================================================

app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        const result = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM users)::INTEGER AS users,
                (SELECT COUNT(*) FROM paiements)::INTEGER AS paiements,
                (SELECT COUNT(*) FROM messages)::INTEGER AS messages,
                (SELECT COUNT(*) FROM demandes_paiement)::INTEGER AS demandes
        `);

        return success(res, {
            status: "ok",
            database: "connected",
            counts: result.rows[0],
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Health error:", error);

        return failure(
            res,
            "La base de données est inaccessible.",
            503
        );
    }
});

// ============================================================
// TEST DATABASE
// ============================================================

app.get("/api/test-db", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                NOW() AS server_time,
                current_database() AS database_name
        `);

        return success(res, {
            message: "Connexion PostgreSQL réussie.",
            database: result.rows[0]
        });
    } catch (error) {
        console.error(error);

        return failure(
            res,
            "Échec de connexion PostgreSQL.",
            500,
            {
                details: error.message
            }
        );
    }
});

// ============================================================
// INSCRIPTION
// ============================================================

async function registerUser(req, res) {
    try {
        const body = req.body || {};

        const nom = cleanString(body.nom, 255);
        const email = normalizeEmail(body.email);
        const telephone = cleanString(
            body.telephone || body.phone,
            100
        );
        const pays = cleanString(body.pays, 150);
        const ville = cleanString(body.ville, 150);
        const domaine = cleanString(
            body.domaine,
            255
        );
        const niveau = cleanString(
            body.niveau,
            100
        );
        const password = cleanString(
            body.password,
            500
        );
        const photo = cleanString(
            body.photo,
            20 * 1024 * 1024
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

        if (password.length < 6) {
            return failure(
                res,
                "Le mot de passe doit contenir au moins 6 caractères."
            );
        }

        const duplicate = await pool.query(
            `
            SELECT id
            FROM users
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
            `,
            [email]
        );

        if (duplicate.rows.length > 0) {
            return failure(
                res,
                "Cette adresse email est déjà utilisée.",
                409
            );
        }

        const hashedPassword =
            await hashPassword(password);

        const result = await pool.query(
            `
            INSERT INTO users
            (
                nom,
                email,
                telephone,
                pays,
                ville,
                domaine,
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
                pays,
                ville,
                domaine,
                niveau,
                photo,
                role,
                premium,
                is_premium,
                premium_until,
                blocked,
                is_blocked,
                certificate_authorized,
                created_at
            `,
            [
                nom,
                email,
                telephone,
                pays,
                ville,
                domaine,
                niveau,
                hashedPassword,
                photo
            ]
        );

        const user = result.rows[0];

        return success(
            res,
            {
                message:
                    "Inscription réussie.",
                user,
                utilisateur: user
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
                details: error.message
            }
        );
    }
}

app.post("/api/inscription", registerUser);
app.post("/api/register", registerUser);
app.post("/api/signup", registerUser);

// ============================================================
// CONNEXION UTILISATEUR
// ============================================================

async function loginUser(req, res) {
    try {
        const body = req.body || {};

        const email = normalizeEmail(
            body.email || body.username
        );

        const password = cleanString(
            body.password,
            500
        );

        if (!email || !password) {
            return failure(
                res,
                "Email et mot de passe obligatoires."
            );
        }

        const result = await pool.query(
            `
            SELECT *
            FROM users
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
            `,
            [email]
        );

        if (result.rows.length === 0) {
            return failure(
                res,
                "Email ou mot de passe incorrect.",
                401
            );
        }

        const user = result.rows[0];

        const passwordValid =
            await verifyPassword(
                password,
                user.password
            );

        if (!passwordValid) {
            return failure(
                res,
                "Email ou mot de passe incorrect.",
                401
            );
        }

        if (isBlockedUser(user)) {
            return failure(
                res,
                "Ce compte a été bloqué par l'administration.",
                403
            );
        }

        const safeUser = {
            id: user.id,
            nom: user.nom,
            email: user.email,
            telephone: user.telephone,
            pays: user.pays,
            ville: user.ville,
            domaine: user.domaine,
            niveau: user.niveau,
            photo: user.photo,
            role: user.role,
            premium: isPremiumUser(user),
            is_premium: isPremiumUser(user),
            premium_until: user.premium_until,
            blocked: isBlockedUser(user),
            is_blocked: isBlockedUser(user),
            certificate_authorized:
                Boolean(
                    user.certificate_authorized
                ),
            created_at: user.created_at
        };

        return success(res, {
            message: "Connexion réussie.",
            user: safeUser,
            utilisateur: safeUser
        });
    } catch (error) {
        console.error(
            "Erreur connexion :",
            error
        );

        return failure(
            res,
            "Erreur lors de la connexion.",
            500
        );
    }
}

app.post("/api/connexion", loginUser);
app.post("/api/login", loginUser);
app.post("/api/signin", loginUser);

// ============================================================
// CONNEXION ADMIN
// ============================================================

app.post("/api/admin/login", async (req, res) => {
    try {
        const body = req.body || {};

        const email = normalizeEmail(
            body.email || body.username
        );

        const password = cleanString(
            body.password,
            500
        );

        if (!email || !password) {
            return failure(
                res,
                "Email et mot de passe administrateur obligatoires."
            );
        }

        // ========================================================
        // ADMIN PRINCIPAL CONFIGURATION
        // ========================================================

        if (
            email === normalizeEmail(ADMIN_EMAIL) &&
            password === ADMIN_PASSWORD
        ) {
            const token =
                createAdminToken(email);

            await logActivity({
                action: "ADMIN_LOGIN",
                details:
                    "Connexion de l'administrateur principal",
                ip:
                    req.headers["x-forwarded-for"] ||
                    req.socket.remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    "Connexion administrateur réussie.",
                token,
                adminToken: token,
                accessToken: token,
                admin: {
                    email,
                    nom: "Administrateur BMJ SERVICE",
                    role: "admin"
                }
            });
        }

        // ========================================================
        // ADMIN JUSTIN
        // ========================================================

        const result = await pool.query(
            `
            SELECT *
            FROM users
            WHERE LOWER(email) = LOWER($1)
              AND LOWER(COALESCE(role, 'user')) = 'admin'
            LIMIT 1
            `,
            [email]
        );

        if (result.rows.length === 0) {
            return failure(
                res,
                "Identifiants administrateur incorrects.",
                401
            );
        }

        const admin = result.rows[0];

        if (isBlockedUser(admin)) {
            return failure(
                res,
                "Ce compte administrateur est bloqué.",
                403
            );
        }

        const valid =
            await verifyPassword(
                password,
                admin.password
            );

        if (!valid) {
            return failure(
                res,
                "Identifiants administrateur incorrects.",
                401
            );
        }

        const token =
            createAdminToken(admin.email);

        await logActivity({
            action: "ADMIN_LOGIN",
            details:
                `Connexion administrateur : ${admin.email}`,
            userId: admin.id,
            ip:
                req.headers["x-forwarded-for"] ||
                req.socket.remoteAddress ||
                ""
        });

        return success(res, {
            message:
                "Connexion administrateur réussie.",
            token,
            adminToken: token,
            accessToken: token,
            admin: {
                id: admin.id,
                nom: admin.nom,
                email: admin.email,
                role: "admin"
            }
        });
    } catch (error) {
        console.error(
            "Erreur login admin :",
            error
        );

        return failure(
            res,
            "Erreur lors de la connexion administrateur.",
            500
        );
    }
});

// ============================================================
// VERIFICATION SESSION ADMIN
// ============================================================

app.get(
    "/api/admin/session",
    adminAuth,
    async (req, res) => {
        return success(res, {
            valid: true,
            admin: {
                email: req.adminEmail,
                role: "admin"
            }
        });
    }
);

// ============================================================
// UTILISATEUR PAR ID — ADMIN
// ============================================================

app.get(
    "/api/utilisateurs/:id",
    adminAuth,
    async (req, res) => {
        try {
            const id = parseId(req.params.id);

            if (!id) {
                return failure(
                    res,
                    "ID utilisateur invalide."
                );
            }

            const result = await pool.query(
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

            if (result.rows.length === 0) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            const user = result.rows[0];

            user.premium =
                isPremiumUser(user);

            user.is_premium =
                user.premium;

            user.blocked =
                isBlockedUser(user);

            user.is_blocked =
                user.blocked;

            return success(res, {
                user,
                utilisateur: user
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
// LISTE UTILISATEURS
// ============================================================

async function getUsers(req, res) {
    try {
        const result = await pool.query(
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

        const users = result.rows.map((user) => {
            const premium =
                isPremiumUser(user);

            const blocked =
                isBlockedUser(user);

            return {
                ...user,
                premium,
                is_premium: premium,
                blocked,
                is_blocked: blocked
            };
        });

        return success(res, {
            utilisateurs: users,
            users,
            apprenants: users,
            total: users.length,
            count: users.length
        });
    } catch (error) {
        console.error(
            "Erreur récupération utilisateurs :",
            error
        );

        return failure(
            res,
            "Impossible de récupérer les utilisateurs.",
            500,
            {
                details: error.message
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

// ============================================================
// MODIFIER UTILISATEUR
// ============================================================

app.patch(
    "/api/admin/users/:id",
    adminAuth,
    async (req, res) => {
        try {
            const id = parseId(req.params.id);

            if (!id) {
                return failure(
                    res,
                    "ID utilisateur invalide."
                );
            }

            const body = req.body || {};

            const fields = [];
            const values = [];
            let index = 1;

            const allowedFields = [
                "nom",
                "email",
                "telephone",
                "pays",
                "ville",
                "domaine",
                "niveau",
                "photo"
            ];

            for (const field of allowedFields) {
                if (
                    Object.prototype.hasOwnProperty.call(
                        body,
                        field
                    )
                ) {
                    let value =
                        body[field];

                    if (field === "email") {
                        value =
                            normalizeEmail(value);
                    } else {
                        value =
                            cleanString(
                                value,
                                field === "photo"
                                    ? 20 * 1024 * 1024
                                    : 1000
                            );
                    }

                    fields.push(
                        `${field} = $${index++}`
                    );

                    values.push(value);
                }
            }

            if (body.password) {
                const newPassword =
                    cleanString(
                        body.password,
                        500
                    );

                if (newPassword.length < 6) {
                    return failure(
                        res,
                        "Le nouveau mot de passe doit contenir au moins 6 caractères."
                    );
                }

                fields.push(
                    `password = $${index++}`
                );

                values.push(
                    await hashPassword(
                        newPassword
                    )
                );
            }

            if (fields.length === 0) {
                return failure(
                    res,
                    "Aucune modification fournie."
                );
            }

            fields.push(
                "updated_at = NOW()"
            );

            values.push(id);

            const result = await pool.query(
                `
                UPDATE users
                SET ${fields.join(", ")}
                WHERE id = $${index}
                RETURNING
                    id,
                    nom,
                    email,
                    telephone,
                    pays,
                    ville,
                    domaine,
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
                values
            );

            if (result.rows.length === 0) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            await logActivity({
                action: "UPDATE_USER",
                details:
                    `Modification de l'utilisateur ${id}`,
                userId: id,
                ip:
                    req.headers["x-forwarded-for"] ||
                    req.socket.remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    "Utilisateur modifié avec succès.",
                user: result.rows[0],
                utilisateur:
                    result.rows[0]
            });
        } catch (error) {
            console.error(
                "Erreur modification utilisateur :",
                error
            );

            return failure(
                res,
                "Impossible de modifier l'utilisateur.",
                500,
                {
                    details: error.message
                }
            );
        }
    }
);

// ============================================================
// ACTIVER PREMIUM
// ============================================================

app.patch(
    "/api/admin/users/:id/premium",
    adminAuth,
    async (req, res) => {
        try {
            const id = parseId(req.params.id);

            if (!id) {
                return failure(
                    res,
                    "ID utilisateur invalide."
                );
            }

            const requestedDays = Number(
                req.body?.days ||
                req.body?.premium_days ||
                req.body?.duree ||
                30
            );

            const days =
                Number.isFinite(requestedDays) &&
                requestedDays > 0
                    ? Math.floor(
                          requestedDays
                      )
                    : 30;

            const existing = await pool.query(
                `
                SELECT *
                FROM users
                WHERE id = $1
                `,
                [id]
            );

            if (existing.rows.length === 0) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            const user =
                existing.rows[0];

            let startDate = new Date();

            if (user.premium_until) {
                const currentExpiration =
                    new Date(
                        user.premium_until
                    );

                if (
                    !Number.isNaN(
                        currentExpiration.getTime()
                    ) &&
                    currentExpiration.getTime() >
                        Date.now()
                ) {
                    startDate =
                        currentExpiration;
                }
            }

            const expiration =
                new Date(
                    startDate.getTime() +
                        days *
                            24 *
                            60 *
                            60 *
                            1000
                );

            const result = await pool.query(
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

            await logActivity({
                action: "ACTIVATE_PREMIUM",
                details:
                    `Premium activé pour ${days} jours`,
                userId: id,
                ip:
                    req.headers["x-forwarded-for"] ||
                    req.socket.remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    `Premium activé pour ${days} jours.`,
                user: result.rows[0],
                utilisateur:
                    result.rows[0]
            });
        } catch (error) {
            console.error(
                "Erreur activation Premium :",
                error
            );

            return failure(
                res,
                "Impossible d'activer Premium.",
                500
            );
        }
    }
);

// ============================================================
// RETIRER PREMIUM / STANDARD
// ============================================================

app.patch(
    "/api/admin/users/:id/standard",
    adminAuth,
    async (req, res) => {
        try {
            const id = parseId(req.params.id);

            if (!id) {
                return failure(
                    res,
                    "ID utilisateur invalide."
                );
            }

            const result = await pool.query(
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

            if (result.rows.length === 0) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            await logActivity({
                action: "REMOVE_PREMIUM",
                details:
                    `Premium retiré de l'utilisateur ${id}`,
                userId: id,
                ip:
                    req.headers["x-forwarded-for"] ||
                    req.socket.remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    "Utilisateur repassé en formule Standard.",
                user: result.rows[0],
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
// BLOQUER
// ============================================================

app.patch(
    "/api/admin/users/:id/block",
    adminAuth,
    async (req, res) => {
        try {
            const id = parseId(req.params.id);

            if (!id) {
                return failure(
                    res,
                    "ID utilisateur invalide."
                );
            }

            const result = await pool.query(
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

            if (result.rows.length === 0) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            await logActivity({
                action: "BLOCK_USER",
                details:
                    `Utilisateur ${id} bloqué`,
                userId: id,
                ip:
                    req.headers["x-forwarded-for"] ||
                    req.socket.remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    "Utilisateur bloqué avec succès.",
                user: result.rows[0],
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
            const id = parseId(req.params.id);

            if (!id) {
                return failure(
                    res,
                    "ID utilisateur invalide."
                );
            }

            const result = await pool.query(
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

            if (result.rows.length === 0) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            await logActivity({
                action: "UNBLOCK_USER",
                details:
                    `Utilisateur ${id} débloqué`,
                userId: id,
                ip:
                    req.headers["x-forwarded-for"] ||
                    req.socket.remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    "Utilisateur débloqué avec succès.",
                user: result.rows[0],
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
            const id = parseId(req.params.id);

            if (!id) {
                return failure(
                    res,
                    "ID utilisateur invalide."
                );
            }

            const blocked =
                toBoolean(req.body?.blocked);

            const result = await pool.query(
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

            if (result.rows.length === 0) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            await logActivity({
                action: blocked
                    ? "BLOCK_USER"
                    : "UNBLOCK_USER",
                details:
                    `Changement de blocage utilisateur ${id}`,
                userId: id,
                ip:
                    req.headers["x-forwarded-for"] ||
                    req.socket.remoteAddress ||
                    ""
            });

            return success(res, {
                message: blocked
                    ? "Utilisateur bloqué."
                    : "Utilisateur débloqué.",
                user: result.rows[0],
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
// AUTORISATION CERTIFICAT
// ============================================================

app.patch(
    "/api/admin/users/:id/certificate",
    adminAuth,
    async (req, res) => {
        try {
            const id = parseId(req.params.id);

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

            const result = await pool.query(
                `
                UPDATE users
                SET
                    certificate_authorized = $1,
                    certificate_authorized_at =
                        CASE
                            WHEN $1 = TRUE THEN NOW()
                            ELSE NULL
                        END,
                    certificate_authorized_by =
                        CASE
                            WHEN $1 = TRUE THEN $2
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

            if (result.rows.length === 0) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            await logActivity({
                action: authorized
                    ? "AUTHORIZE_CERTIFICATE"
                    : "REMOVE_CERTIFICATE_AUTHORIZATION",
                details:
                    `Certificat ${authorized ? "autorisé" : "désautorisé"} pour l'utilisateur ${id}`,
                userId: id,
                ip:
                    req.headers["x-forwarded-for"] ||
                    req.socket.remoteAddress ||
                    ""
            });

            return success(res, {
                message: authorized
                    ? "Certificat autorisé."
                    : "Autorisation du certificat retirée.",
                user: result.rows[0],
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
            const id = parseId(req.params.id);

            if (!id) {
                return failure(
                    res,
                    "ID utilisateur invalide."
                );
            }

            const result = await pool.query(
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

            if (result.rows.length === 0) {
                return failure(
                    res,
                    "Utilisateur introuvable.",
                    404
                );
            }

            const user =
                result.rows[0];

            const premium =
                isPremiumUser(user);

            const blocked =
                isBlockedUser(user);

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
                user_id: user.id
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
// PAIEMENTS — CREATION
// ============================================================

app.post(
    "/api/paiements",
    async (req, res) => {
        try {
            const body = req.body || {};

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
                    details: error.message
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
            const result = await pool.query(
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
            const id = parseId(
                req.params.id
            );

            if (!id) {
                return failure(
                    res,
                    "ID paiement invalide."
                );
            }

            const result = await pool.query(
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

            if (result.rows.length === 0) {
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
// FONCTION ACTIVATION PREMIUM PAR PAIEMENT
// ============================================================

async function activatePremiumForUser(
    client,
    userId,
    days
) {
    const id = parseId(userId);

    if (!id) {
        return null;
    }

    const safeDays =
        Math.max(
            1,
            Math.floor(
                safeNumber(days, 30)
            )
        );

    const result = await client.query(
        `
        SELECT
            id,
            premium_until
        FROM users
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const user =
        result.rows[0];

    let startDate =
        new Date();

    if (user.premium_until) {
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
        await client.query(
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
// VALIDER PAIEMENT
// ============================================================

app.patch(
    "/api/paiements/:id/valider",
    adminAuth,
    async (req, res) => {
        const client =
            await pool.connect();

        try {
            const id =
                parseId(req.params.id);

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
                paymentResult.rows.length === 0
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
                    req.headers["x-forwarded-for"] ||
                    req.socket.remoteAddress ||
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
                parseId(req.params.id);

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
                result.rows.length === 0
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
                    result.rows[0].user_id,
                ip:
                    req.headers["x-forwarded-for"] ||
                    req.socket.remoteAddress ||
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
                parseId(req.params.id);

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
                demandResult.rows.length === 0
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
                    req.headers["x-forwarded-for"] ||
                    req.socket.remoteAddress ||
                    ""
            });

            return success(res, {
                message:
                    "Demande validée avec succès.",
                demande:
                    updated.rows[0],
                user:
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
                parseId(req.params.id);

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
                    result.rows[0].user_id,
                ip:
                    req.headers["x-forwarded-for"] ||
                    req.socket.remoteAddress ||
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
// PROGRESSION UTILISATEUR — MODIFICATION
// ============================================================

app.patch(
    "/api/admin/users/:id/progression",
    adminAuth,
    async (req, res) => {
        try {
            const userId =
                parseId(req.params.id);

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
                        progression = EXCLUDED.progression,
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
                        updated_at = NOW()
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
                    req.headers["x-forwarded-for"] ||
                    req.socket.remoteAddress ||
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
// PROGRESSIONS D'UN UTILISATEUR
// ============================================================

app.get(
    "/api/admin/users/:id/progression",
    adminAuth,
    async (req, res) => {
        try {
            const userId =
                parseId(req.params.id);

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
                userResult.rows.length === 0
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
                    req.headers["x-forwarded-for"] ||
                    req.socket.remoteAddress ||
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
                    SELECT id, nom, email
                    FROM users
                    WHERE id = $1
                    `,
                    [userId]
                );

            if (
                userResult.rows.length === 0
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
                parseId(req.params.id);

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

            if (!userId || !messageId) {
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
                result.rows.length === 0
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
                    WHERE LOWER(COALESCE(status, 'pending'))
                        = 'pending'
                )::INTEGER AS paiements_pending,

                (
                    SELECT COUNT(*)
                    FROM paiements
                    WHERE LOWER(COALESCE(status, ''))
                        = 'validated'
                )::INTEGER AS paiements_validated,

                (
                    SELECT COUNT(*)
                    FROM paiements
                    WHERE LOWER(COALESCE(status, ''))
                        = 'refused'
                )::INTEGER AS paiements_refused,

                (
                    SELECT COALESCE(
                        SUM(
                            CASE
                                WHEN LOWER(COALESCE(status, ''))
                                    = 'validated'
                                THEN COALESCE(amount, montant, 0)
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
                    WHERE LOWER(COALESCE(status, 'pending'))
                        = 'pending'
                )::INTEGER AS demandes_pending,

                (
                    SELECT COUNT(*)
                    FROM demandes_paiement
                    WHERE LOWER(COALESCE(status, ''))
                        = 'validated'
                )::INTEGER AS demandes_validated,

                (
                    SELECT COUNT(*)
                    FROM demandes_paiement
                    WHERE LOWER(COALESCE(status, ''))
                        = 'refused'
                )::INTEGER AS demandes_refused,

                (
                    SELECT COUNT(*)
                    FROM messages
                )::INTEGER AS messages_total,

                (
                    SELECT COUNT(*)
                    FROM messages
                    WHERE LOWER(COALESCE(status, 'unread'))
                        <> 'read'
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
        Number(row.utilisateurs) || 0;

    const premium =
        Number(row.premium) || 0;

    const blocked =
        Number(row.bloques) || 0;

    return {
        utilisateurs: total,
        total_users: total,

        premium,
        premium_users: premium,

        bloques: blocked,
        blocked_users: blocked,

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
                    req.query.limit || 100
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
// ROUTE 404 API
// ============================================================

app.use((req, res) => {
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
});

// ============================================================
// GESTIONNAIRE D'ERREURS
// ============================================================

app.use((error, req, res, next) => {
    console.error(
        "ERREUR SERVEUR :",
        error
    );

    if (res.headersSent) {
        return next(error);
    }

    return res.status(500).json({
        success: false,
        message:
            "Une erreur interne du serveur est survenue.",
        error:
            "INTERNAL_SERVER_ERROR"
    });
});

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

async function gracefulShutdown(signal) {
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
    () => gracefulShutdown("SIGTERM")
);

process.on(
    "SIGINT",
    () => gracefulShutdown("SIGINT")
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