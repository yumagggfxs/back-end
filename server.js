/* ============================================================
   BMJ SERVICE BACKEND
   VERSION 14.0.0
   Node.js + Express + PostgreSQL
   Compatible Render
============================================================ */


/* ============================================================
   1. IMPORTATIONS
============================================================ */

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const crypto = require("crypto");


/* ============================================================
   2. APPLICATION EXPRESS
============================================================ */

const app = express();


/* ============================================================
   3. CONFIGURATION
============================================================ */

const PORT =
    Number(process.env.PORT) || 10000;

const DATABASE_URL =
    process.env.DATABASE_URL;

const ADMIN_EMAIL =
    process.env.ADMIN_EMAIL ||
    "admin@bmjservice.com";

const ADMIN_SECRET =
    process.env.ADMIN_SECRET ||
    "BMJ_SERVICE_CHANGE_THIS_SECRET_2026";


/* ============================================================
   4. MIDDLEWARES
============================================================ */

app.use(
    cors({
        origin: true,
        credentials: false,
        methods: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS"
        ],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "Accept"
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


/* ============================================================
   5. LOG DES REQUÊTES
============================================================ */

app.use(
    function(req, res, next) {

        console.log(
            `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`
        );

        next();
    }
);


/* ============================================================
   6. POSTGRESQL
============================================================ */

if (!DATABASE_URL) {

    console.error(
        "⚠️ DATABASE_URL n'est pas définie."
    );

}

const pool =
    new Pool({

        connectionString:
            DATABASE_URL,

        ssl:
            DATABASE_URL
                ? {
                    rejectUnauthorized: false
                }
                : false,

        max: 10,

        idleTimeoutMillis:
            30000,

        connectionTimeoutMillis:
            10000

    });


pool.on(
    "error",
    function(err) {

        console.error(
            "❌ Erreur PostgreSQL inattendue :",
            err
        );

    }
);


/* ============================================================
   7. OUTILS GÉNÉRAUX
============================================================ */

function parseId(value) {

    const id =
        Number.parseInt(
            value,
            10
        );

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {

        return null;

    }

    return id;
}


function getBoolean(value) {

    if (
        value === true ||
        value === 1 ||
        value === "1" ||
        String(value).toLowerCase() === "true" ||
        String(value).toLowerCase() === "yes" ||
        String(value).toLowerCase() === "oui"
    ) {

        return true;

    }

    return false;

}


function normalizeEmail(value) {

    if (
        value === undefined ||
        value === null
    ) {

        return null;

    }

    return String(value)
        .trim()
        .toLowerCase();

}


function cleanText(
    value,
    maxLength = 10000
) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";

    }

    return String(value)
        .trim()
        .slice(
            0,
            maxLength
        );

}


/* ============================================================
   8. RÉPONSES API
============================================================ */

function success(
    res,
    data = null,
    message = "Opération réussie"
) {

    return res.json({

        success: true,

        message,

        data

    });

}


function error(
    res,
    message = "Une erreur est survenue.",
    status = 500,
    details = undefined
) {

    const response = {

        success: false,

        message

    };

    if (
        details !== undefined &&
        process.env.NODE_ENV !== "production"
    ) {

        response.error =
            details;

    }

    return res
        .status(status)
        .json(response);

}


/* ============================================================
   9. AUTHENTIFICATION ADMIN
============================================================ */

function createAdminToken() {

    const timestamp =
        Date.now();

    const payload =
        `${ADMIN_EMAIL}:${timestamp}`;

    const signature =
        crypto
            .createHmac(
                "sha256",
                ADMIN_SECRET
            )
            .update(payload)
            .digest("hex");

    return Buffer
        .from(
            `${payload}:${signature}`
        )
        .toString("base64");
}


function verifyAdminToken(token) {

    try {

        if (!token) {

            return false;

        }

        const decoded =
            Buffer
                .from(
                    token,
                    "base64"
                )
                .toString("utf8");

        const parts =
            decoded.split(":");

        if (
            parts.length < 3
        ) {

            return false;

        }

        const email =
            parts[0];

        const timestamp =
            Number(parts[1]);

        const signature =
            parts.slice(2).join(":");

        if (
            email !== ADMIN_EMAIL
        ) {

            return false;

        }

        if (
            !Number.isFinite(timestamp)
        ) {

            return false;

        }

        /*
         * Token valable 24 heures.
         */

        if (
            Math.abs(
                Date.now() - timestamp
            ) >
            24 * 60 * 60 * 1000
        ) {

            return false;

        }

        const expected =
            crypto
                .createHmac(
                    "sha256",
                    ADMIN_SECRET
                )
                .update(
                    `${email}:${timestamp}`
                )
                .digest("hex");

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expected)
        );

    } catch {

        return false;

    }

}


function adminAuth(
    req,
    res,
    next
) {

    const authorization =
        req.headers.authorization || "";

    let token = null;

    if (
        authorization.startsWith(
            "Bearer "
        )
    ) {

        token =
            authorization
                .slice(7)
                .trim();

    }

    if (!token) {

        token =
            req.query.token ||
            req.headers["x-admin-token"] ||
            null;

    }

    if (
        !verifyAdminToken(token)
    ) {

        return error(
            res,
            "Accès administrateur refusé.",
            401
        );

    }

    req.admin = {

        email:
            ADMIN_EMAIL

    };

    next();

}


/* ============================================================
   10. ACTIVITÉS ADMIN
============================================================ */

async function logActivity(
    action,
    description,
    userId = null,
    paymentId = null
) {

    try {

        await pool.query(

            `
            INSERT INTO admin_activity
            (
                action,
                description,
                user_id,
                payment_id,
                created_at
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                CURRENT_TIMESTAMP
            )
            `,

            [
                action,
                description,
                userId,
                paymentId
            ]

        );

    } catch (err) {

        console.error(
            "Erreur journal admin :",
            err.message
        );

    }

}


/* ============================================================
   11. TEST BASE DE DONNÉES
============================================================ */

async function testDatabase() {

    const result =
        await pool.query(
            "SELECT NOW() AS now"
        );

    return result.rows[0];

}


/* ============================================================
   12. INITIALISATION DES TABLES
============================================================ */

async function initDatabase() {

    console.log(
        "Initialisation PostgreSQL..."
    );


    /* ========================================================
       USERS
    ======================================================== */

    await pool.query(

        `
        CREATE TABLE IF NOT EXISTS users
        (
            id SERIAL PRIMARY KEY,

            nom TEXT NOT NULL,

            email TEXT UNIQUE NOT NULL,

            telephone TEXT,

            domaine TEXT,

            password TEXT,

            photo TEXT,

            premium BOOLEAN NOT NULL DEFAULT FALSE,

            is_premium BOOLEAN NOT NULL DEFAULT FALSE,

            premium_until TIMESTAMPTZ,

            blocked BOOLEAN NOT NULL DEFAULT FALSE,

            is_blocked BOOLEAN NOT NULL DEFAULT FALSE,

            created_at TIMESTAMPTZ
                NOT NULL DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMPTZ
                NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        `

    );


    /* ========================================================
       MIGRATION USERS
    ======================================================== */

    const userColumns = [

        [
            "telephone",
            "TEXT"
        ],

        [
            "domaine",
            "TEXT"
        ],

        [
            "password",
            "TEXT"
        ],

        [
            "photo",
            "TEXT"
        ],

        [
            "premium",
            "BOOLEAN NOT NULL DEFAULT FALSE"
        ],

        [
            "is_premium",
            "BOOLEAN NOT NULL DEFAULT FALSE"
        ],

        [
            "premium_until",
            "TIMESTAMPTZ"
        ],

        [
            "blocked",
            "BOOLEAN NOT NULL DEFAULT FALSE"
        ],

        [
            "is_blocked",
            "BOOLEAN NOT NULL DEFAULT FALSE"
        ],

        [
            "created_at",
            "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP"
        ],

        [
            "updated_at",
            "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP"
        ]

    ];


    for (
        const [column, definition]
        of userColumns
    ) {

        try {

            await pool.query(
                `
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS
                ${column}
                ${definition}
                `
            );

        } catch (err) {

            console.error(
                `Migration users.${column} :`,
                err.message
            );

        }

    }


    await pool.query(
        `
        CREATE UNIQUE INDEX IF NOT EXISTS
        idx_users_email
        ON users(email)
        `
    );


    await pool.query(
        `
        CREATE INDEX IF NOT EXISTS
        idx_users_premium
        ON users(premium)
        `
    );


    await pool.query(
        `
        CREATE INDEX IF NOT EXISTS
        idx_users_blocked
        ON users(blocked)
        `
    );


    /* ========================================================
       PAIEMENTS
    ======================================================== */

    await pool.query(

        `
        CREATE TABLE IF NOT EXISTS paiements
        (
            id SERIAL PRIMARY KEY,

            user_id INTEGER,

            nom TEXT,

            email TEXT,

            telephone TEXT,

            amount NUMERIC(14,2)
                DEFAULT 0,

            montant NUMERIC(14,2)
                DEFAULT 0,

            currency VARCHAR(10)
                DEFAULT 'USD',

            methode TEXT,

            method TEXT,

            reference TEXT,

            transaction_id TEXT,

            preuve TEXT,

            proof TEXT,

            status VARCHAR(30)
                DEFAULT 'pending',

            premium_days INTEGER
                DEFAULT 30,

            notes TEXT,

            refusal_reason TEXT,

            validated_at TIMESTAMPTZ,

            refused_at TIMESTAMPTZ,

            created_at TIMESTAMPTZ
                NOT NULL DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMPTZ
                NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        `

    );


    const paymentColumns = [

        [
            "user_id",
            "INTEGER"
        ],

        [
            "nom",
            "TEXT"
        ],

        [
            "email",
            "TEXT"
        ],

        [
            "telephone",
            "TEXT"
        ],

        [
            "amount",
            "NUMERIC(14,2) DEFAULT 0"
        ],

        [
            "montant",
            "NUMERIC(14,2) DEFAULT 0"
        ],

        [
            "currency",
            "VARCHAR(10) DEFAULT 'USD'"
        ],

        [
            "methode",
            "TEXT"
        ],

        [
            "method",
            "TEXT"
        ],

        [
            "reference",
            "TEXT"
        ],

        [
            "transaction_id",
            "TEXT"
        ],

        [
            "preuve",
            "TEXT"
        ],

        [
            "proof",
            "TEXT"
        ],

        [
            "status",
            "VARCHAR(30) DEFAULT 'pending'"
        ],

        [
            "premium_days",
            "INTEGER DEFAULT 30"
        ],

        [
            "notes",
            "TEXT"
        ],

        [
            "refusal_reason",
            "TEXT"
        ],

        [
            "validated_at",
            "TIMESTAMPTZ"
        ],

        [
            "refused_at",
            "TIMESTAMPTZ"
        ],

        [
            "created_at",
            "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP"
        ],

        [
            "updated_at",
            "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP"
        ]

    ];


    for (
        const [column, definition]
        of paymentColumns
    ) {

        try {

            await pool.query(
                `
                ALTER TABLE paiements
                ADD COLUMN IF NOT EXISTS
                ${column}
                ${definition}
                `
            );

        } catch (err) {

            console.error(
                `Migration paiements.${column} :`,
                err.message
            );

        }

    }


    await pool.query(
        `
        CREATE INDEX IF NOT EXISTS
        idx_paiements_status
        ON paiements(status)
        `
    );


    await pool.query(
        `
        CREATE INDEX IF NOT EXISTS
        idx_paiements_user
        ON paiements(user_id)
        `
    );


    await pool.query(
        `
        CREATE INDEX IF NOT EXISTS
        idx_paiements_created
        ON paiements(created_at)
        `
    );


    /* ========================================================
       DEMANDES DE PAIEMENT
    ======================================================== */

    await pool.query(

        `
        CREATE TABLE IF NOT EXISTS demandes_paiement
        (
            id SERIAL PRIMARY KEY,

            user_id INTEGER,

            telephone_paiement TEXT NOT NULL,

            reference_paiement TEXT NOT NULL,

            status VARCHAR(30)
                NOT NULL DEFAULT 'pending',

            refusal_reason TEXT,

            validated_at TIMESTAMPTZ,

            refused_at TIMESTAMPTZ,

            created_at TIMESTAMPTZ
                NOT NULL DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMPTZ
                NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        `

    );


    const requestColumns = [

        [
            "user_id",
            "INTEGER"
        ],

        [
            "telephone_paiement",
            "TEXT"
        ],

        [
            "reference_paiement",
            "TEXT"
        ],

        [
            "status",
            "VARCHAR(30) DEFAULT 'pending'"
        ],

        [
            "refusal_reason",
            "TEXT"
        ],

        [
            "validated_at",
            "TIMESTAMPTZ"
        ],

        [
            "refused_at",
            "TIMESTAMPTZ"
        ],

        [
            "created_at",
            "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP"
        ],

        [
            "updated_at",
            "TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP"
        ]

    ];


    for (
        const [column, definition]
        of requestColumns
    ) {

        try {

            await pool.query(
                `
                ALTER TABLE demandes_paiement
                ADD COLUMN IF NOT EXISTS
                ${column}
                ${definition}
                `
            );

        } catch (err) {

            console.error(
                `Migration demandes_paiement.${column} :`,
                err.message
            );

        }

    }


    await pool.query(
        `
        CREATE INDEX IF NOT EXISTS
        idx_demandes_user
        ON demandes_paiement(user_id)
        `
    );


    await pool.query(
        `
        CREATE INDEX IF NOT EXISTS
        idx_demandes_status
        ON demandes_paiement(status)
        `
    );


    await pool.query(
        `
        CREATE INDEX IF NOT EXISTS
        idx_demandes_created
        ON demandes_paiement(created_at)
        `
    );


    /* ========================================================
       ADMIN ACTIVITY
    ======================================================== */

    await pool.query(

        `
        CREATE TABLE IF NOT EXISTS admin_activity
        (
            id SERIAL PRIMARY KEY,

            action TEXT,

            description TEXT,

            user_id INTEGER,

            payment_id INTEGER,

            created_at TIMESTAMPTZ
                NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        `

    );


    /* ========================================================
       MESSAGES
    ======================================================== */

    await initializeMessageDatabase();


    console.log(
        "✓ Base PostgreSQL initialisée."
    );

}


/* ============================================================
   13. ROUTES DE BASE
============================================================ */

app.get(
    "/",
    function(req, res) {

        return res.json({

            success: true,

            message:
                "BMJ SERVICE API fonctionne.",

            api:
                "/api",

            version:
                "14.0.0"

        });

    }
);


app.get(
    "/api",
    function(req, res) {

        return success(
            res,
            {
                api:
                    "BMJ SERVICE API",
                version:
                    "14.0.0",
                status:
                    "online"
            },
            "BMJ SERVICE API fonctionne."
        );

    }
);


app.get(
    "/api/health",
    async function(req, res) {

        try {

            const db =
                await testDatabase();

            return success(
                res,
                {
                    server:
                        "online",

                    database:
                        "connected",

                    time:
                        db.now
                },
                "Serveur opérationnel"
            );

        } catch (err) {

            return error(
                res,
                "Base de données indisponible.",
                503,
                err.message
            );

        }

    }
);


app.get(
    "/api/test-db",
    async function(req, res) {

        try {

            const result =
                await pool.query(
                    "SELECT NOW() AS now"
                );

            return success(
                res,
                result.rows[0],
                "PostgreSQL fonctionne."
            );

        } catch (err) {

            return error(
                res,
                "Erreur connexion PostgreSQL.",
                500,
                err.message
            );

        }

    }
);


/* ============================================================
   14. CONNEXION ADMIN
============================================================ */

app.post(
    "/api/admin/login",
    function(req, res) {

        const email =
            normalizeEmail(
                req.body?.email
            );

        const password =
            String(
                req.body?.password ||
                ""
            );

        const adminPassword =
            process.env.ADMIN_PASSWORD ||
            "BMJ_ADMIN_CHANGE_PASSWORD";

        if (
            email !==
            normalizeEmail(ADMIN_EMAIL)
        ) {

            return error(
                res,
                "Identifiants administrateur incorrects.",
                401
            );

        }

        if (
            password !== adminPassword
        ) {

            return error(
                res,
                "Identifiants administrateur incorrects.",
                401
            );

        }

        const token =
            createAdminToken();

        return success(
            res,
            {
                token,
                email:
                    ADMIN_EMAIL
            },
            "Connexion administrateur réussie"
        );

    }
);


/* ============================================================
   15. INSCRIPTION UTILISATEUR
============================================================ */

async function registerUser(
    req,
    res
) {

    try {

        const body =
            req.body || {};

        const nom =
            cleanText(
                body.nom,
                255
            );

        const email =
            normalizeEmail(
                body.email
            );

        const telephone =
            cleanText(
                body.telephone,
                100
            );

        const domaine =
            cleanText(
                body.domaine,
                255
            );

        const password =
            String(
                body.password ||
                body.mot_de_passe ||
                ""
            );

        const photo =
            body.photo ||
            null;


        if (!nom) {

            return error(
                res,
                "Le nom est obligatoire.",
                400
            );

        }


        if (
            !email ||
            !email.includes("@")
        ) {

            return error(
                res,
                "Adresse email invalide.",
                400
            );

        }


        if (
            password.length < 4
        ) {

            return error(
                res,
                "Le mot de passe doit contenir au moins 4 caractères.",
                400
            );

        }


        const existing =
            await pool.query(

                `
                SELECT id
                FROM users
                WHERE LOWER(email)=LOWER($1)
                LIMIT 1
                `,

                [email]

            );


        if (
            existing.rows.length
        ) {

            return error(
                res,
                "Cette adresse email est déjà utilisée.",
                409
            );

        }


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
                    photo,
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
                    $5,
                    $6,
                    false,
                    false,
                    false,
                    false
                )
                RETURNING
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
                    created_at
                `,

                [
                    nom,
                    email,
                    telephone || null,
                    domaine || null,
                    password,
                    photo
                ]

            );


        const user =
            result.rows[0];


        await logActivity(
            "CREATE_USER",
            `Utilisateur ${user.id} créé`,
            user.id
        );


        return success(
            res,
            user,
            "Inscription réussie"
        );

    } catch (err) {

        return error(
            res,
            "Impossible de créer le compte.",
            500,
            err.message
        );

    }

}


app.post(
    "/api/utilisateurs",
    registerUser
);


app.post(
    "/api/users",
    registerUser
);


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


/* ============================================================
   16. CONNEXION UTILISATEUR
============================================================ */

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
                req.body?.mot_de_passe ||
                ""
            );


        if (
            !email ||
            !password
        ) {

            return error(
                res,
                "Email et mot de passe obligatoires.",
                400
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
                    premium,
                    is_premium,
                    premium_until,
                    blocked,
                    is_blocked,
                    password,
                    created_at,
                    updated_at
                FROM users
                WHERE LOWER(email)=LOWER($1)
                LIMIT 1
                `,

                [email]

            );


        if (
            !result.rows.length
        ) {

            return error(
                res,
                "Email ou mot de passe incorrect.",
                401
            );

        }


        const user =
            result.rows[0];


        if (
            user.blocked === true ||
            user.is_blocked === true
        ) {

            return error(
                res,
                "Votre compte est bloqué.",
                403
            );

        }


        if (
            String(user.password || "") !==
            password
        ) {

            return error(
                res,
                "Email ou mot de passe incorrect.",
                401
            );

        }


        delete user.password;


        return success(
            res,
            user,
            "Connexion réussie"
        );

    } catch (err) {

        return error(
            res,
            "Impossible de se connecter.",
            500,
            err.message
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


/* ============================================================
   17. UTILISATEURS PUBLICS
============================================================ */

async function getUsersPublic(
    req,
    res
) {

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
                    premium,
                    is_premium,
                    premium_until,
                    blocked,
                    is_blocked,
                    created_at
                FROM users
                ORDER BY created_at DESC
                `

            );


        return success(
            res,
            result.rows,
            "Utilisateurs chargés"
        );

    } catch (err) {

        return error(
            res,
            "Impossible de charger les utilisateurs.",
            500,
            err.message
        );

    }

}


app.get(
    "/api/utilisateurs",
    getUsersPublic
);


app.get(
    "/api/users",
    getUsersPublic
);


/* ============================================================
   18. UTILISATEUR PAR ID
============================================================ */

async function getUserById(
    req,
    res
) {

    try {

        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            return error(
                res,
                "ID utilisateur invalide.",
                400
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
                    premium,
                    is_premium,
                    premium_until,
                    blocked,
                    is_blocked,
                    created_at,
                    updated_at
                FROM users
                WHERE id=$1
                `,

                [id]

            );


        if (
            !result.rows.length
        ) {

            return error(
                res,
                "Utilisateur introuvable.",
                404
            );

        }


        return success(
            res,
            result.rows[0],
            "Utilisateur trouvé"
        );

    } catch (err) {

        return error(
            res,
            "Erreur utilisateur.",
            500,
            err.message
        );

    }

}


app.get(
    "/api/utilisateurs/:id",
    getUserById
);


app.get(
    "/api/users/:id",
    getUserById
);


/* ============================================================
   19. ADMIN — LISTE UTILISATEURS
============================================================ */

async function getAdminUsers(
    req,
    res
) {

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
                    premium,
                    is_premium,
                    premium_until,
                    blocked,
                    is_blocked,
                    created_at,
                    updated_at
                FROM users
                ORDER BY created_at DESC
                `

            );


        return success(
            res,
            result.rows,
            "Utilisateurs chargés"
        );

    } catch (err) {

        return error(
            res,
            "Impossible de charger les utilisateurs.",
            500,
            err.message
        );

    }

}


app.get(
    "/api/admin/utilisateurs",
    adminAuth,
    getAdminUsers
);


app.get(
    "/api/admin/users",
    adminAuth,
    getAdminUsers
);


/* ============================================================
   20. MODIFIER UTILISATEUR
============================================================ */

async function updateUser(
    req,
    res
) {

    try {

        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            return error(
                res,
                "ID utilisateur invalide.",
                400
            );

        }


        const body =
            req.body || {};


        const nom =
            body.nom !== undefined
                ? cleanText(
                    body.nom,
                    255
                )
                : null;


        const email =
            body.email !== undefined
                ? normalizeEmail(
                    body.email
                )
                : null;


        const telephone =
            body.telephone !== undefined
                ? cleanText(
                    body.telephone,
                    100
                )
                : null;


        const domaine =
            body.domaine !== undefined
                ? cleanText(
                    body.domaine,
                    255
                )
                : null;


        const photo =
            body.photo !== undefined
                ? body.photo
                : null;


        if (email) {

            const check =
                await pool.query(

                    `
                    SELECT id
                    FROM users
                    WHERE LOWER(email)=LOWER($1)
                    AND id<>$2
                    LIMIT 1
                    `,

                    [
                        email,
                        id
                    ]

                );


            if (
                check.rows.length
            ) {

                return error(
                    res,
                    "Cette adresse email est déjà utilisée.",
                    409
                );

            }

        }


        const result =
            await pool.query(

                `
                UPDATE users
                SET
                    nom=COALESCE($1,nom),
                    email=COALESCE($2,email),
                    telephone=COALESCE($3,telephone),
                    domaine=COALESCE($4,domaine),
                    photo=COALESCE($5,photo),
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=$6
                RETURNING
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
                    created_at,
                    updated_at
                `,

                [
                    nom,
                    email,
                    telephone,
                    domaine,
                    photo,
                    id
                ]

            );


        if (
            !result.rows.length
        ) {

            return error(
                res,
                "Utilisateur introuvable.",
                404
            );

        }


        await logActivity(
            "UPDATE_USER",
            `Utilisateur ${id} modifié`,
            id
        );


        return success(
            res,
            result.rows[0],
            "Utilisateur modifié"
        );

    } catch (err) {

        return error(
            res,
            "Impossible de modifier l'utilisateur.",
            500,
            err.message
        );

    }

}


app.put(
    "/api/utilisateurs/:id",
    adminAuth,
    updateUser
);


app.patch(
    "/api/utilisateurs/:id",
    adminAuth,
    updateUser
);


/* ============================================================
   21. SUPPRIMER UTILISATEUR
============================================================ */

async function deleteUser(
    req,
    res
) {

    try {

        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            return error(
                res,
                "ID utilisateur invalide.",
                400
            );

        }


        /*
         * On conserve les paiements.
         */

        await pool.query(

            `
            UPDATE paiements
            SET user_id=NULL
            WHERE user_id=$1
            `,

            [id]

        );


        /*
         * On conserve les demandes.
         */

        await pool.query(

            `
            UPDATE demandes_paiement
            SET user_id=NULL
            WHERE user_id=$1
            `,

            [id]

        );


        /*
         * Pour les messages, on ne supprime pas
         * l'historique.
         */

        await pool.query(

            `
            UPDATE messages
            SET
                recipient_user_id=NULL,
                updated_at=CURRENT_TIMESTAMP
            WHERE recipient_user_id=$1
            `,

            [id]

        );


        const result =
            await pool.query(

                `
                DELETE FROM users
                WHERE id=$1
                RETURNING id
                `,

                [id]

            );


        if (
            !result.rows.length
        ) {

            return error(
                res,
                "Utilisateur introuvable.",
                404
            );

        }


        await logActivity(
            "DELETE_USER",
            `Utilisateur ${id} supprimé`,
            id
        );


        return success(
            res,
            result.rows[0],
            "Utilisateur supprimé"
        );

    } catch (err) {

        return error(
            res,
            "Impossible de supprimer l'utilisateur.",
            500,
            err.message
        );

    }

}


app.delete(
    "/api/utilisateurs/:id",
    adminAuth,
    deleteUser
);


/* ============================================================
   22. PREMIUM MANUEL
============================================================ */

async function setUserPremium(
    req,
    res
) {

    try {

        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            return error(
                res,
                "ID utilisateur invalide.",
                400
            );

        }


        const body =
            req.body || {};


        let enabled = true;


        if (
            body.enabled !== undefined
        ) {

            enabled =
                getBoolean(
                    body.enabled
                );

        } else if (
            body.premium !== undefined
        ) {

            enabled =
                getBoolean(
                    body.premium
                );

        } else if (
            body.is_premium !== undefined
        ) {

            enabled =
                getBoolean(
                    body.is_premium
                );

        }


        const days =
            Number(
                body.days ??
                body.premium_days ??
                30
            );


        if (
            enabled &&
            (
                !Number.isInteger(days) ||
                days <= 0 ||
                days > 3650
            )
        ) {

            return error(
                res,
                "Nombre de jours Premium invalide.",
                400
            );

        }


        const userResult =
            await pool.query(

                `
                SELECT
                    id,
                    nom,
                    email,
                    premium,
                    is_premium,
                    premium_until
                FROM users
                WHERE id=$1
                LIMIT 1
                `,

                [id]

            );


        if (
            !userResult.rows.length
        ) {

            return error(
                res,
                "Utilisateur introuvable.",
                404
            );

        }


        const user =
            userResult.rows[0];


        /*
         * Désactivation.
         */

        if (!enabled) {

            const result =
                await pool.query(

                    `
                    UPDATE users
                    SET
                        premium=false,
                        is_premium=false,
                        premium_until=NULL,
                        updated_at=CURRENT_TIMESTAMP
                    WHERE id=$1
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


            await logActivity(
                "DISABLE_PREMIUM",
                `Premium désactivé pour utilisateur ${id}`,
                id
            );


            return success(
                res,
                {
                    ...result.rows[0],
                    premium_days: 0
                },
                "Le statut Premium a été retiré."
            );

        }


        /*
         * Activation.
         */

        const now =
            new Date();

        let baseDate =
            now;


        if (
            user.premium_until
        ) {

            const current =
                new Date(
                    user.premium_until
                );

            if (
                !Number.isNaN(
                    current.getTime()
                ) &&
                current > now
            ) {

                baseDate =
                    current;

            }

        }


        const premiumUntil =
            new Date(
                baseDate
            );


        premiumUntil.setDate(
            premiumUntil.getDate() +
            days
        );


        const result =
            await pool.query(

                `
                UPDATE users
                SET
                    premium=true,
                    is_premium=true,
                    premium_until=$1,
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=$2
                RETURNING
                    id,
                    nom,
                    email,
                    premium,
                    is_premium,
                    premium_until
                `,

                [
                    premiumUntil,
                    id
                ]

            );


        await logActivity(
            "ENABLE_PREMIUM",
            `Premium activé pour utilisateur ${id} pendant ${days} jours`,
            id
        );


        return success(
            res,
            {
                ...result.rows[0],
                premium_days:
                    days
            },
            "Le statut Premium a été activé."
        );

    } catch (err) {

        return error(
            res,
            "Impossible de modifier le statut Premium.",
            500,
            err.message
        );

    }

}


app.patch(
    "/api/admin/users/:id/premium",
    adminAuth,
    setUserPremium
);


/* ============================================================
   23. BLOQUER / DÉBLOQUER
============================================================ */

async function blockUser(
    req,
    res
) {

    try {

        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            return error(
                res,
                "ID utilisateur invalide.",
                400
            );

        }


        const blocked =
            req.body?.blocked !== undefined
                ? getBoolean(
                    req.body.blocked
                )
                : true;


        const result =
            await pool.query(

                `
                UPDATE users
                SET
                    blocked=$1,
                    is_blocked=$1,
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=$2
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
            !result.rows.length
        ) {

            return error(
                res,
                "Utilisateur introuvable.",
                404
            );

        }


        await logActivity(
            blocked
                ? "BLOCK_USER"
                : "UNBLOCK_USER",
            blocked
                ? `Utilisateur ${id} bloqué`
                : `Utilisateur ${id} débloqué`,
            id
        );


        return success(
            res,
            result.rows[0],
            blocked
                ? "Utilisateur bloqué"
                : "Utilisateur débloqué"
        );

    } catch (err) {

        return error(
            res,
            "Impossible de modifier le blocage.",
            500,
            err.message
        );

    }

}


app.patch(
    "/api/admin/users/:id/block",
    adminAuth,
    blockUser
);


/* ============================================================
   24. MESSAGERIE
============================================================ */

const MESSAGE_TYPES = {

    USER:
        "user",

    OFFICIAL:
        "official",

    USER_REPLY:
        "user_reply"

};


const MESSAGE_PRIORITIES = {

    NORMAL:
        "normal",

    IMPORTANT:
        "important",

    URGENT:
        "urgent"

};


const MESSAGE_AUDIENCES = {

    ALL:
        "all",

    STANDARD:
        "standard",

    PREMIUM:
        "premium",

    INDIVIDUAL:
        "individual",

    ADMIN:
        "admin"

};


const messageSSEClients =
    new Map();


function normalizeMessagePriority(
    value
) {

    const priority =
        String(
            value || ""
        ).toLowerCase();


    if (
        priority === "urgent"
    ) {

        return "urgent";

    }


    if (
        priority === "important"
    ) {

        return "important";

    }


    return "normal";

}


function normalizeMessageAudience(
    value
) {

    const audience =
        String(
            value || ""
        ).toLowerCase();


    if (
        [
            "all",
            "standard",
            "premium",
            "individual",
            "admin"
        ].includes(audience)
    ) {

        return audience;

    }


    return "individual";

}


function normalizeMessageType(
    value
) {

    const type =
        String(
            value || ""
        ).toLowerCase();


    if (
        [
            "official",
            "user_reply",
            "user"
        ].includes(type)
    ) {

        return type;

    }


    return "user";

}


function messageUserIsPremium(
    user
) {

    if (!user) {

        return false;

    }


    if (
        user.premium === true ||
        user.is_premium === true
    ) {

        return true;

    }


    if (
        user.premium_until
    ) {

        const until =
            new Date(
                user.premium_until
            );

        if (
            !Number.isNaN(
                until.getTime()
            ) &&
            until > new Date()
        ) {

            return true;

        }

    }


    return false;

}


function getMessageId(
    value
) {

    return parseId(value);

}


function cleanMessageText(
    value,
    maxLength = 10000
) {

    return cleanText(
        value,
        maxLength
    );

}


function getAdminEmail() {

    return ADMIN_EMAIL;

}


async function getMessageUserById(
    userId
) {

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
                premium,
                is_premium,
                premium_until,
                blocked,
                is_blocked,
                created_at,
                updated_at
            FROM users
            WHERE id=$1
            LIMIT 1
            `,

            [userId]

        );


    return result.rows[0] ||
        null;

}


/* ============================================================
   25. INITIALISATION MESSAGES
============================================================ */

async function initializeMessageDatabase() {

    await pool.query(

        `
        CREATE TABLE IF NOT EXISTS messages
        (
            id SERIAL PRIMARY KEY,

            sender_type VARCHAR(30)
                NOT NULL DEFAULT 'admin',

            sender_user_id INTEGER,

            sender_name TEXT,

            sender_email TEXT,

            recipient_user_id INTEGER,

            recipient_name TEXT,

            recipient_email TEXT,

            subject TEXT
                NOT NULL DEFAULT 'Message BMJ SERVICE',

            content TEXT
                NOT NULL,

            type VARCHAR(30)
                NOT NULL DEFAULT 'user',

            priority VARCHAR(20)
                NOT NULL DEFAULT 'normal',

            audience VARCHAR(30)
                NOT NULL DEFAULT 'individual',

            status VARCHAR(30)
                NOT NULL DEFAULT 'unread',

            read_at TIMESTAMPTZ,

            created_at TIMESTAMPTZ
                NOT NULL DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMPTZ
                NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        `

    );


    const columns = [

        [
            "sender_type",
            "VARCHAR(30) DEFAULT 'admin'"
        ],

        [
            "sender_user_id",
            "INTEGER"
        ],

        [
            "sender_name",
            "TEXT"
        ],

        [
            "sender_email",
            "TEXT"
        ],

        [
            "recipient_user_id",
            "INTEGER"
        ],

        [
            "recipient_name",
            "TEXT"
        ],

        [
            "recipient_email",
            "TEXT"
        ],

        [
            "subject",
            "TEXT DEFAULT 'Message BMJ SERVICE'"
        ],

        [
            "content",
            "TEXT"
        ],

        [
            "type",
            "VARCHAR(30) DEFAULT 'user'"
        ],

        [
            "priority",
            "VARCHAR(20) DEFAULT 'normal'"
        ],

        [
            "audience",
            "VARCHAR(30) DEFAULT 'individual'"
        ],

        [
            "status",
            "VARCHAR(30) DEFAULT 'unread'"
        ],

        [
            "read_at",
            "TIMESTAMPTZ"
        ],

        [
            "created_at",
            "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"
        ],

        [
            "updated_at",
            "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"
        ]

    ];


    for (
        const [column, definition]
        of columns
    ) {

        try {

            await pool.query(
                `
                ALTER TABLE messages
                ADD COLUMN IF NOT EXISTS
                ${column}
                ${definition}
                `
            );

        } catch (err) {

            console.error(
                `Migration messages.${column} :`,
                err.message
            );

        }

    }


    await pool.query(
        `
        CREATE INDEX IF NOT EXISTS
        idx_messages_recipient_user
        ON messages(recipient_user_id)
        `
    );


    await pool.query(
        `
        CREATE INDEX IF NOT EXISTS
        idx_messages_created
        ON messages(created_at)
        `
    );


    await pool.query(
        `
        CREATE INDEX IF NOT EXISTS
        idx_messages_type
        ON messages(type)
        `
    );


    await pool.query(
        `
        CREATE INDEX IF NOT EXISTS
        idx_messages_audience
        ON messages(audience)
        `
    );


    await pool.query(
        `
        CREATE INDEX IF NOT EXISTS
        idx_messages_status
        ON messages(status)
        `
    );


    console.log(
        "✓ Table messages vérifiée."
    );

}


/* ============================================================
   26. SSE MESSAGERIE
============================================================ */

function notifyMessageUser(
    userId,
    message = null
) {

    const clients =
        messageSSEClients.get(
            userId
        );


    if (!clients) {

        return;

    }


    const payload =
        {

            success: true,

            type:
                "new_message",

            message,

            timestamp:
                new Date().toISOString()

        };


    for (
        const client
        of clients
    ) {

        try {

            client.write(
                "event: message\n"
            );

            client.write(
                `data: ${JSON.stringify(payload)}\n\n`
            );

        } catch {

            clients.delete(
                client
            );

        }

    }


    if (
        clients.size === 0
    ) {

        messageSSEClients.delete(
            userId
        );

    }

}


async function notifyMessageUsers(
    users,
    message
) {

    for (
        const user
        of users
    ) {

        notifyMessageUser(
            user.id,
            message
        );

    }

}


function formatMessageForUser(
    message
) {

    return {

        id:
            message.id,

        sender_type:
            message.sender_type,

        sender_user_id:
            message.sender_user_id,

        sender_name:
            message.sender_name,

        sender_email:
            message.sender_email,

        recipient_user_id:
            message.recipient_user_id,

        recipient_name:
            message.recipient_name,

        recipient_email:
            message.recipient_email,

        subject:
            message.subject,

        content:
            message.content,

        type:
            message.type,

        priority:
            message.priority,

        audience:
            message.audience,

        status:
            message.status ||
            "unread",

        read_at:
            message.read_at,

        created_at:
            message.created_at,

        updated_at:
            message.updated_at

    };

}


async function getCompleteMessageById(
    messageId
) {

    const result =
        await pool.query(

            `
            SELECT
                m.*,

                u.nom
                    AS user_nom,

                u.email
                    AS user_email

            FROM messages m

            LEFT JOIN users u
                ON u.id =
                   m.recipient_user_id

            WHERE m.id=$1

            LIMIT 1
            `,

            [messageId]

        );


    return result.rows[0] ||
        null;

}


/* ============================================================
   27. ADMIN — TOUS LES MESSAGES
============================================================ */

app.get(
    "/api/messages",
    adminAuth,
    async function(req, res) {

        try {

            const result =
                await pool.query(

                    `
                    SELECT
                        m.*,

                        u.nom
                            AS user_nom,

                        u.email
                            AS user_email

                    FROM messages m

                    LEFT JOIN users u
                        ON u.id =
                           m.recipient_user_id

                    ORDER BY
                        m.created_at DESC,
                        m.id DESC
                    `

                );


            return success(
                res,
                result.rows,
                "Messages chargés"
            );

        } catch (err) {

            return error(
                res,
                "Impossible de charger les messages.",
                500,
                err.message
            );

        }

    }
);


/* ============================================================
   28. ADMIN — RÉPONSES UTILISATEURS
============================================================ */

app.get(
    "/api/messages/reponses",
    adminAuth,
    async function(req, res) {

        try {

            const result =
                await pool.query(

                    `
                    SELECT
                        m.*,

                        u.nom
                            AS user_nom,

                        u.email
                            AS user_email,

                        u.telephone
                            AS user_telephone

                    FROM messages m

                    LEFT JOIN users u
                        ON u.id =
                           m.sender_user_id

                    WHERE LOWER(
                        COALESCE(
                            m.sender_type,
                            ''
                        )
                    )='user'

                    ORDER BY
                        m.created_at DESC,
                        m.id DESC
                    `

                );


            return success(
                res,
                result.rows,
                "Réponses chargées"
            );

        } catch (err) {

            return error(
                res,
                "Impossible de charger les réponses.",
                500,
                err.message
            );

        }

    }
);


/* ============================================================
   29. MESSAGE ADMIN PAR ID
============================================================ */

app.get(
    "/api/messages/:id",
    adminAuth,
    async function(req, res) {

        try {

            const id =
                getMessageId(
                    req.params.id
                );


            if (!id) {

                return error(
                    res,
                    "ID message invalide.",
                    400
                );

            }


            const message =
                await getCompleteMessageById(
                    id
                );


            if (!message) {

                return error(
                    res,
                    "Message introuvable.",
                    404
                );

            }


            return success(
                res,
                formatMessageForUser(
                    message
                ),
                "Message trouvé"
            );

        } catch (err) {

            return error(
                res,
                "Impossible de charger le message.",
                500,
                err.message
            );

        }

    }
);


/* ============================================================
   30. ENVOYER MESSAGE INDIVIDUEL
============================================================ */

async function sendIndividualMessage(
    req,
    res
) {

    try {

        const userId =
            getMessageId(
                req.body?.user_id ??
                req.body?.userId
            );


        const subject =
            cleanMessageText(
                req.body?.subject ||
                "Message BMJ SERVICE",
                500
            );


        const content =
            cleanMessageText(
                req.body?.content,
                10000
            );


        const priority =
            normalizeMessagePriority(
                req.body?.priority
            );


        if (!userId) {

            return error(
                res,
                "Utilisateur invalide.",
                400
            );

        }


        if (!content) {

            return error(
                res,
                "Le contenu du message est obligatoire.",
                400
            );

        }


        const user =
            await getMessageUserById(
                userId
            );


        if (!user) {

            return error(
                res,
                "Utilisateur introuvable.",
                404
            );

        }


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
                    'BMJ SERVICE',
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    'user',
                    $7,
                    'individual',
                    'unread'
                )
                RETURNING *
                `,

                [
                    ADMIN_EMAIL,
                    user.id,
                    user.nom,
                    user.email,
                    subject,
                    content,
                    priority
                ]

            );


        const message =
            formatMessageForUser(
                result.rows[0]
            );


        notifyMessageUser(
            user.id,
            message
        );


        await logActivity(
            "MESSAGE_SEND_USER",
            `Message ${message.id} envoyé à utilisateur ${user.id}`,
            user.id
        );


        return res
            .status(201)
            .json({

                success: true,

                message:
                    "Message envoyé.",

                data:
                    message

            });

    } catch (err) {

        return error(
            res,
            "Impossible d'envoyer le message.",
            500,
            err.message
        );

    }

}


app.post(
    "/api/messages/send-user",
    adminAuth,
    sendIndividualMessage
);


app.post(
    "/api/messages/user",
    adminAuth,
    sendIndividualMessage
);


/* ============================================================
   31. MESSAGE OFFICIEL
============================================================ */

async function sendOfficialMessage(
    req,
    res,
    forcedAudience = null
) {

    try {

        const audience =
            normalizeMessageAudience(
                forcedAudience ||
                req.body?.audience ||
                "all"
            );


        const subject =
            cleanMessageText(
                req.body?.subject ||
                "Annonce BMJ SERVICE",
                500
            );


        const content =
            cleanMessageText(
                req.body?.content,
                10000
            );


        const priority =
            normalizeMessagePriority(
                req.body?.priority
            );


        if (!content) {

            return error(
                res,
                "Le contenu du message est obligatoire.",
                400
            );

        }


        const result =
            await pool.query(

                `
                INSERT INTO messages
                (
                    sender_type,
                    sender_name,
                    sender_email,
                    recipient_user_id,
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
                    'BMJ SERVICE',
                    $1,
                    NULL,
                    $2,
                    $3,
                    'official',
                    $4,
                    $5,
                    'unread'
                )
                RETURNING *
                `,

                [
                    ADMIN_EMAIL,
                    subject,
                    content,
                    priority,
                    audience
                ]

            );


        let usersQuery =
            `
            SELECT id
            FROM users
            `;

        let queryParams = [];


        if (
            audience === "standard"
        ) {

            usersQuery +=
                `
                WHERE
                    COALESCE(premium,false)=false
                    AND
                    COALESCE(is_premium,false)=false
                    AND
                    (
                        premium_until IS NULL
                        OR
                        premium_until <= NOW()
                    )
                `;

        }


        if (
            audience === "premium"
        ) {

            usersQuery +=
                `
                WHERE
                    COALESCE(premium,false)=true
                    OR
                    COALESCE(is_premium,false)=true
                    OR
                    premium_until > NOW()
                `;

        }


        const usersResult =
            await pool.query(
                usersQuery,
                queryParams
            );


        const message =
            formatMessageForUser(
                result.rows[0]
            );


        await notifyMessageUsers(
            usersResult.rows,
            message
        );


        await logActivity(
            "MESSAGE_SEND_OFFICIAL",
            `Annonce officielle envoyée à ${audience}`,
            null
        );


        return res
            .status(201)
            .json({

                success: true,

                message:
                    "Annonce envoyée.",

                data: {

                    message,

                    audience,

                    recipients:
                        usersResult.rows.length

                }

            });

    } catch (err) {

        return error(
            res,
            "Impossible d'envoyer l'annonce.",
            500,
            err.message
        );

    }

}


app.post(
    "/api/messages/send-official",
    adminAuth,
    sendOfficialMessage
);


app.post(
    "/api/messages/official",
    adminAuth,
    sendOfficialMessage
);


app.post(
    "/api/messages/send-all",
    adminAuth,
    function(req, res) {

        return sendOfficialMessage(
            req,
            res,
            "all"
        );

    }
);


app.post(
    "/api/messages/send-standard",
    adminAuth,
    function(req, res) {

        return sendOfficialMessage(
            req,
            res,
            "standard"
        );

    }
);


app.post(
    "/api/messages/send-premium",
    adminAuth,
    function(req, res) {

        return sendOfficialMessage(
            req,
            res,
            "premium"
        );

    }
);


/* ============================================================
   32. MODIFIER MESSAGE
============================================================ */

app.patch(
    "/api/messages/:id",
    adminAuth,
    async function(req, res) {

        try {

            const id =
                getMessageId(
                    req.params.id
                );


            if (!id) {

                return error(
                    res,
                    "ID message invalide.",
                    400
                );

            }


            const existing =
                await getCompleteMessageById(
                    id
                );


            if (!existing) {

                return error(
                    res,
                    "Message introuvable.",
                    404
                );

            }


            const subject =
                req.body?.subject !== undefined
                    ? cleanMessageText(
                        req.body.subject,
                        500
                    )
                    : null;


            const content =
                req.body?.content !== undefined
                    ? cleanMessageText(
                        req.body.content,
                        10000
                    )
                    : null;


            const priority =
                req.body?.priority !== undefined
                    ? normalizeMessagePriority(
                        req.body.priority
                    )
                    : null;


            const result =
                await pool.query(

                    `
                    UPDATE messages
                    SET
                        subject=COALESCE($1,subject),
                        content=COALESCE($2,content),
                        priority=COALESCE($3,priority),
                        updated_at=CURRENT_TIMESTAMP
                    WHERE id=$4
                    RETURNING *
                    `,

                    [
                        subject,
                        content,
                        priority,
                        id
                    ]

                );


            const message =
                formatMessageForUser(
                    result.rows[0]
                );


            if (
                message.recipient_user_id
            ) {

                notifyMessageUser(
                    message.recipient_user_id,
                    message
                );

            }


            return success(
                res,
                message,
                "Message modifié"
            );

        } catch (err) {

            return error(
                res,
                "Impossible de modifier le message.",
                500,
                err.message
            );

        }

    }
);


/* ============================================================
   33. CONVERTIR MESSAGE
============================================================ */

app.post(
    "/api/messages/:id/convert",
    adminAuth,
    async function(req, res) {

        try {

            const id =
                getMessageId(
                    req.params.id
                );


            if (!id) {

                return error(
                    res,
                    "ID message invalide.",
                    400
                );

            }


            const mode =
                String(
                    req.body?.mode ||
                    ""
                ).toLowerCase();


            if (
                mode === "user"
            ) {

                const userId =
                    getMessageId(
                        req.body?.user_id ??
                        req.body?.userId
                    );


                if (!userId) {

                    return error(
                        res,
                        "Utilisateur invalide.",
                        400
                    );

                }


                const user =
                    await getMessageUserById(
                        userId
                    );


                if (!user) {

                    return error(
                        res,
                        "Utilisateur introuvable.",
                        404
                    );

                }


                const result =
                    await pool.query(

                        `
                        UPDATE messages
                        SET
                            type='user',
                            audience='individual',
                            recipient_user_id=$1,
                            recipient_name=$2,
                            recipient_email=$3,
                            updated_at=CURRENT_TIMESTAMP
                        WHERE id=$4
                        RETURNING *
                        `,

                        [
                            user.id,
                            user.nom,
                            user.email,
                            id
                        ]

                    );


                if (
                    !result.rows.length
                ) {

                    return error(
                        res,
                        "Message introuvable.",
                        404
                    );

                }


                const message =
                    formatMessageForUser(
                        result.rows[0]
                    );


                notifyMessageUser(
                    user.id,
                    message
                );


                return success(
                    res,
                    message,
                    "Message converti en message utilisateur"
                );

            }


            if (
                mode === "official"
            ) {

                const audience =
                    normalizeMessageAudience(
                        req.body?.audience ||
                        "all"
                    );


                const result =
                    await pool.query(

                        `
                        UPDATE messages
                        SET
                            type='official',
                            audience=$1,
                            recipient_user_id=NULL,
                            recipient_name=NULL,
                            recipient_email=NULL,
                            updated_at=CURRENT_TIMESTAMP
                        WHERE id=$2
                        RETURNING *
                        `,

                        [
                            audience,
                            id
                        ]

                    );


                if (
                    !result.rows.length
                ) {

                    return error(
                        res,
                        "Message introuvable.",
                        404
                    );

                }


                return success(
                    res,
                    formatMessageForUser(
                        result.rows[0]
                    ),
                    "Message converti en annonce officielle"
                );

            }


            return error(
                res,
                "Mode de conversion invalide.",
                400
            );

        } catch (err) {

            return error(
                res,
                "Impossible de convertir le message.",
                500,
                err.message
            );

        }

    }
);


/* ============================================================
   34. SUPPRIMER MESSAGE
============================================================ */

app.delete(
    "/api/messages/:id",
    adminAuth,
    async function(req, res) {

        try {

            const id =
                getMessageId(
                    req.params.id
                );


            if (!id) {

                return error(
                    res,
                    "ID message invalide.",
                    400
                );

            }


            const result =
                await pool.query(

                    `
                    DELETE FROM messages
                    WHERE id=$1
                    RETURNING id
                    `,

                    [id]

                );


            if (
                !result.rows.length
            ) {

                return error(
                    res,
                    "Message introuvable.",
                    404
                );

            }


            return success(
                res,
                result.rows[0],
                "Message supprimé"
            );

        } catch (err) {

            return error(
                res,
                "Impossible de supprimer le message.",
                500,
                err.message
            );

        }

    }
);


/* ============================================================
   35. MESSAGES UTILISATEUR
============================================================ */

app.get(
    "/api/utilisateurs/:id/messages",
    async function(req, res) {

        try {

            const userId =
                getMessageId(
                    req.params.id
                );


            if (!userId) {

                return error(
                    res,
                    "Utilisateur invalide.",
                    400
                );

            }


            const user =
                await getMessageUserById(
                    userId
                );


            if (!user) {

                return error(
                    res,
                    "Utilisateur introuvable.",
                    404
                );

            }


            const premium =
                messageUserIsPremium(
                    user
                );


            const result =
                await pool.query(

                    `
                    SELECT *
                    FROM messages
                    WHERE
                        recipient_user_id=$1

                        OR

                        (
                            type='official'
                            AND audience='all'
                        )

                        OR

                        (
                            type='official'
                            AND audience='standard'
                            AND $2=false
                        )

                        OR

                        (
                            type='official'
                            AND audience='premium'
                            AND $2=true
                        )

                    ORDER BY
                        created_at DESC,
                        id DESC
                    `,

                    [
                        userId,
                        premium
                    ]

                );


            return success(
                res,
                result.rows.map(
                    formatMessageForUser
                ),
                "Messages chargés"
            );

        } catch (err) {

            return error(
                res,
                "Impossible de charger les messages.",
                500,
                err.message
            );

        }

    }
);


/* ============================================================
   36. MESSAGE UTILISATEUR PAR ID
============================================================ */

app.get(
    "/api/utilisateurs/:userId/messages/:messageId",
    async function(req, res) {

        try {

            const userId =
                getMessageId(
                    req.params.userId
                );

            const messageId =
                getMessageId(
                    req.params.messageId
                );


            if (
                !userId ||
                !messageId
            ) {

                return error(
                    res,
                    "Identifiants invalides.",
                    400
                );

            }


            const user =
                await getMessageUserById(
                    userId
                );


            if (!user) {

                return error(
                    res,
                    "Utilisateur introuvable.",
                    404
                );

            }


            const premium =
                messageUserIsPremium(
                    user
                );


            const result =
                await pool.query(

                    `
                    SELECT *
                    FROM messages
                    WHERE id=$1
                    AND
                    (
                        recipient_user_id=$2

                        OR
                        (
                            type='official'
                            AND audience='all'
                        )

                        OR
                        (
                            type='official'
                            AND audience='standard'
                            AND $3=false
                        )

                        OR
                        (
                            type='official'
                            AND audience='premium'
                            AND $3=true
                        )
                    )
                    LIMIT 1
                    `,

                    [
                        messageId,
                        userId,
                        premium
                    ]

                );


            if (
                !result.rows.length
            ) {

                return error(
                    res,
                    "Message introuvable.",
                    404
                );

            }


            return success(
                res,
                formatMessageForUser(
                    result.rows[0]
                ),
                "Message trouvé"
            );

        } catch (err) {

            return error(
                res,
                "Impossible de charger le message.",
                500,
                err.message
            );

        }

    }
);


/* ============================================================
   37. MARQUER MESSAGE COMME LU
============================================================ */

app.patch(
    "/api/utilisateurs/:userId/messages/:messageId/read",
    async function(req, res) {

        try {

            const userId =
                getMessageId(
                    req.params.userId
                );

            const messageId =
                getMessageId(
                    req.params.messageId
                );


            if (
                !userId ||
                !messageId
            ) {

                return error(
                    res,
                    "Identifiants invalides.",
                    400
                );

            }


            const result =
                await pool.query(

                    `
                    UPDATE messages
                    SET
                        status='read',
                        read_at=CURRENT_TIMESTAMP,
                        updated_at=CURRENT_TIMESTAMP
                    WHERE id=$1
                    AND recipient_user_id=$2
                    RETURNING *
                    `,

                    [
                        messageId,
                        userId
                    ]

                );


            if (
                result.rows.length
            ) {

                return success(
                    res,
                    formatMessageForUser(
                        result.rows[0]
                    ),
                    "Message marqué comme lu"
                );

            }


            const official =
                await pool.query(

                    `
                    SELECT *
                    FROM messages
                    WHERE id=$1
                    AND type='official'
                    LIMIT 1
                    `,

                    [messageId]

                );


            if (
                official.rows.length
            ) {

                return success(
                    res,
                    formatMessageForUser(
                        official.rows[0]
                    ),
                    "Annonce ouverte"
                );

            }


            return error(
                res,
                "Message introuvable.",
                404
            );

        } catch (err) {

            return error(
                res,
                "Impossible de marquer le message.",
                500,
                err.message
            );

        }

    }
);


/* ============================================================
   38. COMPATIBILITÉ READ ADMIN
============================================================ */

app.patch(
    "/api/messages/:id/read",
    adminAuth,
    async function(req, res) {

        try {

            const id =
                getMessageId(
                    req.params.id
                );


            if (!id) {

                return error(
                    res,
                    "ID message invalide.",
                    400
                );

            }


            const result =
                await pool.query(

                    `
                    UPDATE messages
                    SET
                        status='read',
                        read_at=CURRENT_TIMESTAMP,
                        updated_at=CURRENT_TIMESTAMP
                    WHERE id=$1
                    RETURNING *
                    `,

                    [id]

                );


            if (
                !result.rows.length
            ) {

                return error(
                    res,
                    "Message introuvable.",
                    404
                );

            }


            return success(
                res,
                formatMessageForUser(
                    result.rows[0]
                ),
                "Message marqué comme lu"
            );

        } catch (err) {

            return error(
                res,
                "Impossible de marquer le message.",
                500,
                err.message
            );

        }

    }
);


/* ============================================================
   39. RÉPONSE UTILISATEUR
============================================================ */

async function processUserMessageReply(
    userId,
    messageId,
    content
) {

    userId =
        getMessageId(userId);

    messageId =
        getMessageId(messageId);

    content =
        cleanMessageText(
            content,
            10000
        );


    if (!userId) {

        throw new Error(
            "Utilisateur invalide."
        );

    }


    if (!messageId) {

        throw new Error(
            "Message invalide."
        );

    }


    if (!content) {

        throw new Error(
            "Le contenu de la réponse est obligatoire."
        );

    }


    const user =
        await getMessageUserById(
            userId
        );


    if (!user) {

        throw new Error(
            "Utilisateur introuvable."
        );

    }


    const original =
        await pool.query(

            `
            SELECT *
            FROM messages
            WHERE id=$1
            AND recipient_user_id=$2
            LIMIT 1
            `,

            [
                messageId,
                userId
            ]

        );


    if (
        !original.rows.length
    ) {

        throw new Error(
            "Message original introuvable."
        );

    }


    const originalMessage =
        original.rows[0];


    if (
        originalMessage.type ===
        "official"
    ) {

        throw new Error(
            "Une annonce officielle ne peut pas recevoir de réponse directe."
        );

    }


    if (
        originalMessage.type ===
        "user_reply"
    ) {

        throw new Error(
            "Ce message est déjà une réponse."
        );

    }


    if (
        String(
            originalMessage.sender_type ||
            ""
        ).toLowerCase() !==
        "admin"
    ) {

        throw new Error(
            "Ce message ne peut pas recevoir cette réponse."
        );

    }


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
                status
            )
            VALUES
            (
                'user',
                $1,
                $2,
                $3,
                NULL,
                'BMJ SERVICE',
                $4,
                $5,
                $6,
                'user_reply',
                'normal',
                'admin',
                'unread'
            )
            RETURNING *
            `,

            [
                user.id,
                user.nom,
                user.email,
                getAdminEmail(),
                `Réponse : ${originalMessage.subject || "Message"}`,
                content
            ]

        );


    const reply =
        formatMessageForUser(
            result.rows[0]
        );


    await logActivity(
        "USER_MESSAGE_REPLY",
        `Utilisateur ${user.id} a répondu au message ${messageId}`,
        user.id
    );


    return reply;

}


/* ============================================================
   40. RÉPONDRE
============================================================ */

app.post(
    "/api/utilisateurs/:userId/messages/:messageId/repondre",
    async function(req, res) {

        try {

            const reply =
                await processUserMessageReply(
                    req.params.userId,
                    req.params.messageId,
                    req.body?.content
                );


            return res
                .status(201)
                .json({

                    success: true,

                    message:
                        "Votre réponse a été envoyée.",

                    data:
                        reply

                });

        } catch (err) {

            return error(
                res,
                err.message ||
                "Impossible d'envoyer votre réponse.",
                400
            );

        }

    }
);


app.post(
    "/api/utilisateurs/:userId/messages/:messageId/reply",
    async function(req, res) {

        try {

            const reply =
                await processUserMessageReply(
                    req.params.userId,
                    req.params.messageId,
                    req.body?.content
                );


            return res
                .status(201)
                .json({

                    success: true,

                    message:
                        "Votre réponse a été envoyée.",

                    data:
                        reply

                });

        } catch (err) {

            return error(
                res,
                err.message ||
                "Impossible d'envoyer votre réponse.",
                400
            );

        }

    }
);


app.post(
    "/api/messages/reply",
    async function(req, res) {

        try {

            const reply =
                await processUserMessageReply(
                    req.body?.user_id ??
                    req.body?.userId,
                    req.body?.message_id ??
                    req.body?.messageId,
                    req.body?.content
                );


            return res
                .status(201)
                .json({

                    success: true,

                    message:
                        "Votre réponse a été envoyée.",

                    data:
                        reply

                });

        } catch (err) {

            return error(
                res,
                err.message ||
                "Impossible d'envoyer votre réponse.",
                400
            );

        }

    }
);


/* ============================================================
   41. CONVERSATION ADMIN / UTILISATEUR
============================================================ */

app.get(
    "/api/admin/messages/user/:userId",
    adminAuth,
    async function(req, res) {

        try {

            const userId =
                getMessageId(
                    req.params.userId
                );


            if (!userId) {

                return error(
                    res,
                    "Utilisateur invalide.",
                    400
                );

            }


            const user =
                await getMessageUserById(
                    userId
                );


            if (!user) {

                return error(
                    res,
                    "Utilisateur introuvable.",
                    404
                );

            }


            const result =
                await pool.query(

                    `
                    SELECT *
                    FROM messages
                    WHERE
                        recipient_user_id=$1

                        OR

                        (
                            sender_user_id=$1
                            AND
                            LOWER(
                                COALESCE(
                                    sender_type,
                                    ''
                                )
                            )='user'
                        )

                    ORDER BY
                        created_at ASC,
                        id ASC
                    `,

                    [userId]

                );


            return success(
                res,
                {
                    user,
                    messages:
                        result.rows,
                    count:
                        result.rows.length
                },
                "Conversation chargée"
            );

        } catch (err) {

            return error(
                res,
                "Impossible de récupérer la conversation.",
                500,
                err.message
            );

        }

    }
);


/* ============================================================
   42. SSE UTILISATEUR
============================================================ */

app.get(
    "/api/utilisateurs/:userId/messages/stream",
    async function(req, res) {

        const userId =
            getMessageId(
                req.params.userId
            );


        if (!userId) {

            return error(
                res,
                "Utilisateur invalide.",
                400
            );

        }


        try {

            const user =
                await getMessageUserById(
                    userId
                );


            if (!user) {

                return res
                    .status(404)
                    .end();

            }


            res.status(200);


            res.setHeader(
                "Content-Type",
                "text/event-stream"
            );


            res.setHeader(
                "Cache-Control",
                "no-cache, no-transform"
            );


            res.setHeader(
                "Connection",
                "keep-alive"
            );


            res.setHeader(
                "X-Accel-Buffering",
                "no"
            );


            if (
                typeof res.flushHeaders ===
                "function"
            ) {

                res.flushHeaders();

            }


            if (
                !messageSSEClients.has(
                    userId
                )
            ) {

                messageSSEClients.set(
                    userId,
                    new Set()
                );

            }


            const clients =
                messageSSEClients.get(
                    userId
                );


            clients.add(res);


            res.write(
                "event: connected\n"
            );


            res.write(
                `data: ${JSON.stringify({
                    success: true,
                    user_id: userId
                })}\n\n`
            );


            const heartbeat =
                setInterval(
                    function() {

                        try {

                            res.write(
                                `: heartbeat ${Date.now()}\n\n`
                            );

                        } catch {

                            clearInterval(
                                heartbeat
                            );

                            clients.delete(
                                res
                            );

                        }

                    },
                    20000
                );


            req.on(
                "close",
                function() {

                    clearInterval(
                        heartbeat
                    );


                    clients.delete(
                        res
                    );


                    if (
                        clients.size === 0
                    ) {

                        messageSSEClients.delete(
                            userId
                        );

                    }

                }
            );

        } catch (err) {

            console.error(
                "SSE messagerie :",
                err
            );


            try {

                res.end();

            } catch {}

        }

    }
);


/* ============================================================
   43. PAIEMENTS — LISTE
============================================================ */

async function getPayments(
    req,
    res
) {

    try {

        const result =
            await pool.query(

                `
                SELECT
                    p.*,

                    u.nom
                        AS user_nom_db,

                    u.email
                        AS user_email_db,

                    u.telephone
                        AS user_telephone_db

                FROM paiements p

                LEFT JOIN users u
                    ON u.id=p.user_id

                ORDER BY
                    p.created_at DESC
                `

            );


        const data =
            result.rows.map(
                function(payment) {

                    return {

                        ...payment,

                        nom:
                            payment.nom ||
                            payment.user_nom_db ||
                            null,

                        email:
                            payment.email ||
                            payment.user_email_db ||
                            null,

                        telephone:
                            payment.telephone ||
                            payment.user_telephone_db ||
                            null,

                        amount:
                            payment.amount ??
                            payment.montant ??
                            0,

                        montant:
                            payment.montant ??
                            payment.amount ??
                            0,

                        method:
                            payment.method ||
                            payment.methode ||
                            null,

                        methode:
                            payment.methode ||
                            payment.method ||
                            null,

                        reference:
                            payment.reference ||
                            payment.transaction_id ||
                            null,

                        transaction_id:
                            payment.transaction_id ||
                            payment.reference ||
                            null,

                        proof:
                            payment.proof ||
                            payment.preuve ||
                            null,

                        preuve:
                            payment.preuve ||
                            payment.proof ||
                            null,

                        status:
                            payment.status ||
                            "pending"

                    };

                }
            );


        return success(
            res,
            data,
            "Paiements chargés"
        );

    } catch (err) {

        return error(
            res,
            "Impossible de charger les paiements.",
            500,
            err.message
        );

    }

}


app.get(
    "/api/paiements",
    getPayments
);


app.get(
    "/api/admin/paiements",
    adminAuth,
    getPayments
);


app.get(
    "/api/admin/payments",
    adminAuth,
    getPayments
);


/* ============================================================
   44. PAIEMENT PAR ID
============================================================ */

async function getPaymentById(
    req,
    res
) {

    try {

        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            return error(
                res,
                "ID paiement invalide.",
                400
            );

        }


        const result =
            await pool.query(

                `
                SELECT
                    p.*,

                    u.nom
                        AS user_nom_db,

                    u.email
                        AS user_email_db,

                    u.telephone
                        AS user_telephone_db

                FROM paiements p

                LEFT JOIN users u
                    ON u.id=p.user_id

                WHERE p.id=$1

                LIMIT 1
                `,

                [id]

            );


        if (
            !result.rows.length
        ) {

            return error(
                res,
                "Paiement introuvable.",
                404
            );

        }


        return success(
            res,
            result.rows[0],
            "Paiement trouvé"
        );

    } catch (err) {

        return error(
            res,
            "Erreur paiement.",
            500,
            err.message
        );

    }

}


app.get(
    "/api/paiements/:id",
    getPaymentById
);


/* ============================================================
   45. CRÉER PAIEMENT
============================================================ */

async function createPayment(
    req,
    res
) {

    try {

        const body =
            req.body || {};


        const userId =
            parseId(
                body.user_id ??
                body.userId
            );


        const amount =
            Number(
                body.amount ??
                body.montant ??
                0
            );


        if (
            !Number.isFinite(amount) ||
            amount < 0
        ) {

            return error(
                res,
                "Montant du paiement invalide.",
                400
            );

        }


        const currency =
            cleanText(
                body.currency ||
                "USD",
                10
            );


        const method =
            cleanText(
                body.method ||
                body.methode ||
                body.mode_paiement ||
                "",
                100
            );


        const reference =
            cleanText(
                body.reference ||
                body.transaction_id ||
                body.transactionId ||
                "",
                255
            );


        const proof =
            body.preuve ||
            body.proof ||
            body.image ||
            null;


        let user = null;


        if (userId) {

            const userResult =
                await pool.query(

                    `
                    SELECT *
                    FROM users
                    WHERE id=$1
                    LIMIT 1
                    `,

                    [userId]

                );


            if (
                !userResult.rows.length
            ) {

                return error(
                    res,
                    "Utilisateur associé introuvable.",
                    404
                );

            }


            user =
                userResult.rows[0];

        }


        const nom =
            body.nom ||
            user?.nom ||
            null;


        const email =
            body.email ||
            user?.email ||
            null;


        const telephone =
            body.telephone ||
            user?.telephone ||
            null;


        const premiumDays =
            Number(
                body.premium_days ??
                body.premiumDays ??
                30
            );


        if (
            !Number.isInteger(
                premiumDays
            ) ||
            premiumDays <= 0 ||
            premiumDays > 3650
        ) {

            return error(
                res,
                "Nombre de jours Premium invalide.",
                400
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
                    method,
                    reference,
                    transaction_id,
                    preuve,
                    proof,
                    status,
                    premium_days,
                    notes
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
                    $7,
                    $8,
                    $8,
                    $9,
                    $9,
                    'pending',
                    $10,
                    $11
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
                    method || null,
                    reference || null,
                    proof,
                    premiumDays,
                    body.notes ||
                    null
                ]

            );


        const payment =
            result.rows[0];


        await logActivity(
            "CREATE_PAYMENT",
            `Paiement ${payment.id} créé`,
            userId,
            payment.id
        );


        return success(
            res,
            payment,
            "Paiement enregistré avec succès"
        );

    } catch (err) {

        return error(
            res,
            "Impossible d'enregistrer le paiement.",
            500,
            err.message
        );

    }

}


app.post(
    "/api/paiements",
    createPayment
);


app.post(
    "/api/paiements/manual",
    adminAuth,
    createPayment
);


app.post(
    "/api/admin/paiements/manual",
    adminAuth,
    createPayment
);


/* ============================================================
   46. VALIDATION PAIEMENT
============================================================ */

async function validatePayment(
    req,
    res
) {

    const client =
        await pool.connect();


    try {

        await client.query(
            "BEGIN"
        );


        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            await client.query(
                "ROLLBACK"
            );

            return error(
                res,
                "ID paiement invalide.",
                400
            );

        }


        const paymentResult =
            await client.query(

                `
                SELECT *
                FROM paiements
                WHERE id=$1
                FOR UPDATE
                `,

                [id]

            );


        if (
            !paymentResult.rows.length
        ) {

            await client.query(
                "ROLLBACK"
            );

            return error(
                res,
                "Paiement introuvable.",
                404
            );

        }


        const payment =
            paymentResult.rows[0];


        const status =
            String(
                payment.status ||
                ""
            ).toLowerCase();


        if (
            status === "validated"
        ) {

            await client.query(
                "ROLLBACK"
            );

            return error(
                res,
                "Ce paiement est déjà validé.",
                409
            );

        }


        if (
            status === "refused"
        ) {

            await client.query(
                "ROLLBACK"
            );

            return error(
                res,
                "Ce paiement a déjà été refusé.",
                409
            );

        }


        const userId =
            parseId(
                payment.user_id
            );


        if (!userId) {

            await client.query(
                "ROLLBACK"
            );

            return error(
                res,
                "Ce paiement n'est associé à aucun utilisateur.",
                400
            );

        }


        const userResult =
            await client.query(

                `
                SELECT *
                FROM users
                WHERE id=$1
                FOR UPDATE
                `,

                [userId]

            );


        if (
            !userResult.rows.length
        ) {

            await client.query(
                "ROLLBACK"
            );

            return error(
                res,
                "Utilisateur associé introuvable.",
                404
            );

        }


        const user =
            userResult.rows[0];


        const days =
            Number(
                payment.premium_days ||
                30
            );


        const now =
            new Date();

        let baseDate =
            now;


        if (
            user.premium_until
        ) {

            const current =
                new Date(
                    user.premium_until
                );


            if (
                current > now
            ) {

                baseDate =
                    current;

            }

        }


        const newPremiumUntil =
            new Date(
                baseDate
            );


        newPremiumUntil.setDate(
            newPremiumUntil.getDate() +
            days
        );


        await client.query(

            `
            UPDATE users
            SET
                premium=true,
                is_premium=true,
                premium_until=$1,
                updated_at=CURRENT_TIMESTAMP
            WHERE id=$2
            `,

            [
                newPremiumUntil,
                userId
            ]

        );


        const updatedPayment =
            await client.query(

                `
                UPDATE paiements
                SET
                    status='validated',
                    validated_at=CURRENT_TIMESTAMP,
                    refusal_reason=NULL,
                    refused_at=NULL,
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=$1
                RETURNING *
                `,

                [id]

            );


        await client.query(
            "COMMIT"
        );


        await logActivity(
            "VALIDATE_PAYMENT",
            `Paiement ${id} validé - Premium activé`,
            userId,
            id
        );


        return success(
            res,
            {
                payment:
                    updatedPayment.rows[0],

                user_id:
                    userId,

                premium:
                    true,

                is_premium:
                    true,

                premium_until:
                    newPremiumUntil,

                premium_days:
                    days
            },
            "Paiement validé et Premium activé"
        );

    } catch (err) {

        try {

            await client.query(
                "ROLLBACK"
            );

        } catch {}


        return error(
            res,
            "Impossible de valider le paiement.",
            500,
            err.message
        );

    } finally {

        client.release();

    }

}


app.patch(
    "/api/paiements/:id/valider",
    adminAuth,
    validatePayment
);


app.patch(
    "/api/admin/paiements/:id/valider",
    adminAuth,
    validatePayment
);


/* ============================================================
   47. REFUSER PAIEMENT
============================================================ */

async function refusePayment(
    req,
    res
) {

    try {

        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            return error(
                res,
                "ID paiement invalide.",
                400
            );

        }


        const reason =
            cleanText(
                req.body?.reason ||
                req.body?.motif ||
                req.body?.refusal_reason ||
                "Paiement refusé par l'administrateur",
                1000
            );


        const result =
            await pool.query(

                `
                UPDATE paiements
                SET
                    status='refused',
                    refusal_reason=$1,
                    refused_at=CURRENT_TIMESTAMP,
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=$2
                AND LOWER(
                    COALESCE(status,'pending')
                ) <> 'validated'
                RETURNING *
                `,

                [
                    reason,
                    id
                ]

            );


        if (
            !result.rows.length
        ) {

            const check =
                await pool.query(

                    `
                    SELECT id,status
                    FROM paiements
                    WHERE id=$1
                    `,

                    [id]

                );


            if (
                !check.rows.length
            ) {

                return error(
                    res,
                    "Paiement introuvable.",
                    404
                );

            }


            return error(
                res,
                "Un paiement déjà validé ne peut pas être refusé.",
                409
            );

        }


        const payment =
            result.rows[0];


        await logActivity(
            "REFUSE_PAYMENT",
            `Paiement ${id} refusé : ${reason}`,
            payment.user_id,
            id
        );


        return success(
            res,
            payment,
            "Paiement refusé"
        );

    } catch (err) {

        return error(
            res,
            "Impossible de refuser le paiement.",
            500,
            err.message
        );

    }

}


app.patch(
    "/api/paiements/:id/refuser",
    adminAuth,
    refusePayment
);


app.patch(
    "/api/admin/paiements/:id/refuser",
    adminAuth,
    refusePayment
);


/* ============================================================
   48. MODIFIER PAIEMENT
============================================================ */

async function updatePayment(
    req,
    res
) {

    try {

        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            return error(
                res,
                "ID paiement invalide.",
                400
            );

        }


        const body =
            req.body || {};


        const status =
            body.status !== undefined
                ? cleanText(
                    body.status,
                    30
                )
                : null;


        const reference =
            body.reference ||
            body.transaction_id ||
            body.transactionId ||
            null;


        const method =
            body.method ||
            body.methode ||
            body.mode_paiement ||
            null;


        const notes =
            body.notes !== undefined
                ? cleanText(
                    body.notes,
                    5000
                )
                : null;


        const refusalReason =
            body.refusal_reason ||
            body.reason ||
            body.motif ||
            null;


        const amount =
            body.amount ??
            body.montant ??
            null;


        const currency =
            body.currency ||
            null;


        const result =
            await pool.query(

                `
                UPDATE paiements
                SET
                    status=COALESCE($1,status),

                    reference=COALESCE(
                        $2,
                        reference
                    ),

                    transaction_id=COALESCE(
                        $2,
                        transaction_id
                    ),

                    methode=COALESCE(
                        $3,
                        methode
                    ),

                    method=COALESCE(
                        $3,
                        method
                    ),

                    amount=COALESCE(
                        $4,
                        amount
                    ),

                    montant=COALESCE(
                        $4,
                        montant
                    ),

                    currency=COALESCE(
                        $5,
                        currency
                    ),

                    notes=COALESCE(
                        $6,
                        notes
                    ),

                    refusal_reason=COALESCE(
                        $7,
                        refusal_reason
                    ),

                    updated_at=CURRENT_TIMESTAMP

                WHERE id=$8

                RETURNING *
                `,

                [
                    status,
                    reference,
                    method,
                    amount,
                    currency,
                    notes,
                    refusalReason,
                    id
                ]

            );


        if (
            !result.rows.length
        ) {

            return error(
                res,
                "Paiement introuvable.",
                404
            );

        }


        await logActivity(
            "UPDATE_PAYMENT",
            `Paiement ${id} modifié`,
            result.rows[0].user_id,
            id
        );


        return success(
            res,
            result.rows[0],
            "Paiement modifié"
        );

    } catch (err) {

        return error(
            res,
            "Impossible de modifier le paiement.",
            500,
            err.message
        );

    }

}


app.put(
    "/api/paiements/:id",
    adminAuth,
    updatePayment
);


app.patch(
    "/api/paiements/:id",
    adminAuth,
    updatePayment
);


/* ============================================================
   49. SUPPRIMER PAIEMENT
============================================================ */

app.delete(
    "/api/paiements/:id",
    adminAuth,
    async function(req, res) {

        try {

            const id =
                parseId(
                    req.params.id
                );


            if (!id) {

                return error(
                    res,
                    "ID paiement invalide.",
                    400
                );

            }


            const result =
                await pool.query(

                    `
                    DELETE FROM paiements
                    WHERE id=$1
                    RETURNING
                        id,
                        user_id
                    `,

                    [id]

                );


            if (
                !result.rows.length
            ) {

                return error(
                    res,
                    "Paiement introuvable.",
                    404
                );

            }


            await logActivity(
                "DELETE_PAYMENT",
                `Paiement ${id} supprimé`,
                null,
                id
            );


            return success(
                res,
                result.rows[0],
                "Paiement supprimé"
            );

        } catch (err) {

            return error(
                res,
                "Impossible de supprimer le paiement.",
                500,
                err.message
            );

        }

    }
);


/* ============================================================
   50. DEMANDES DE PAIEMENT
============================================================ */

async function createPaymentRequest(
    req,
    res
) {

    try {

        const body =
            req.body || {};


        const userId =
            parseId(
                body.user_id ??
                body.userId
            );


        const telephonePaiement =
            cleanText(

                body.telephone_paiement ??
                body.telephonePaiement ??
                body.numero_paiement ??
                body.numeroPaiement ??
                "",

                100

            );


        const referencePaiement =
            cleanText(

                body.reference_paiement ??
                body.referencePaiement ??
                body.reference ??
                "",

                255

            );


        if (!userId) {

            return error(
                res,
                "Utilisateur invalide.",
                400
            );

        }


        if (!telephonePaiement) {

            return error(
                res,
                "Le numéro ayant effectué le paiement est obligatoire.",
                400
            );

        }


        if (!referencePaiement) {

            return error(
                res,
                "La référence du paiement est obligatoire.",
                400
            );

        }


        if (
            telephonePaiement.length < 6
        ) {

            return error(
                res,
                "Numéro de paiement invalide.",
                400
            );

        }


        if (
            referencePaiement.length < 2
        ) {

            return error(
                res,
                "Référence de paiement invalide.",
                400
            );

        }


        const userResult =
            await pool.query(

                `
                SELECT
                    id,
                    nom,
                    email,
                    telephone,
                    premium,
                    is_premium,
                    premium_until,
                    blocked,
                    is_blocked
                FROM users
                WHERE id=$1
                LIMIT 1
                `,

                [userId]

            );


        if (
            !userResult.rows.length
        ) {

            return error(
                res,
                "Utilisateur introuvable.",
                404
            );

        }


        const user =
            userResult.rows[0];


        if (
            user.blocked === true ||
            user.is_blocked === true
        ) {

            return error(
                res,
                "Votre compte est bloqué.",
                403
            );

        }


        const pending =
            await pool.query(

                `
                SELECT id
                FROM demandes_paiement
                WHERE user_id=$1
                AND LOWER(
                    COALESCE(status,'pending')
                )='pending'
                LIMIT 1
                `,

                [userId]

            );


        if (
            pending.rows.length
        ) {

            return error(
                res,
                "Vous avez déjà une demande de paiement en attente.",
                409,
                {
                    demande_id:
                        pending.rows[0].id
                }
            );

        }


        const referenceUsed =
            await pool.query(

                `
                SELECT id
                FROM demandes_paiement
                WHERE LOWER(
                    reference_paiement
                )=LOWER($1)
                LIMIT 1
                `,

                [referencePaiement]

            );


        if (
            referenceUsed.rows.length
        ) {

            return error(
                res,
                "Cette référence de paiement a déjà été utilisée.",
                409
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
                    status
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    'pending'
                )
                RETURNING *
                `,

                [
                    userId,
                    telephonePaiement,
                    referencePaiement
                ]

            );


        const demande =
            result.rows[0];


        await logActivity(
            "CREATE_PAYMENT_REQUEST",
            `Demande de paiement ${demande.id} créée pour utilisateur ${userId}`,
            userId
        );


        return success(
            res,
            {
                ...demande,

                user: {

                    id:
                        user.id,

                    nom:
                        user.nom,

                    email:
                        user.email

                }

            },
            "Votre demande de paiement a été enregistrée."
        );

    } catch (err) {

        return error(
            res,
            "Impossible d'enregistrer la demande de paiement.",
            500,
            err.message
        );

    }

}


app.post(
    "/api/demandes-paiement",
    createPaymentRequest
);


/* ============================================================
   51. LISTE DEMANDES DE PAIEMENT
============================================================ */

async function getPaymentRequests(
    req,
    res
) {

    try {

        const result =
            await pool.query(

                `
                SELECT
                    d.id,
                    d.user_id,
                    d.telephone_paiement,
                    d.reference_paiement,
                    d.status,
                    d.refusal_reason,
                    d.created_at,
                    d.validated_at,
                    d.refused_at,
                    d.updated_at,

                    u.nom
                        AS user_nom,

                    u.email
                        AS user_email,

                    u.telephone
                        AS user_telephone,

                    u.domaine
                        AS user_domaine

                FROM demandes_paiement d

                LEFT JOIN users u
                    ON u.id=d.user_id

                ORDER BY
                    d.created_at DESC
                `

            );


        return success(
            res,
            result.rows,
            "Demandes de paiement chargées"
        );

    } catch (err) {

        return error(
            res,
            "Impossible de charger les demandes de paiement.",
            500,
            err.message
        );

    }

}


app.get(
    "/api/demandes-paiement",
    getPaymentRequests
);


app.get(
    "/api/admin/demandes-paiement",
    adminAuth,
    getPaymentRequests
);


/* ============================================================
   52. DEMANDE DE PAIEMENT PAR ID
============================================================ */

async function getPaymentRequestById(
    req,
    res
) {

    try {

        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            return error(
                res,
                "ID de demande invalide.",
                400
            );

        }


        const result =
            await pool.query(

                `
                SELECT
                    d.*,

                    u.nom
                        AS user_nom,

                    u.email
                        AS user_email,

                    u.telephone
                        AS user_telephone,

                    u.domaine
                        AS user_domaine,

                    u.premium
                        AS user_premium,

                    u.is_premium
                        AS user_is_premium,

                    u.premium_until
                        AS user_premium_until

                FROM demandes_paiement d

                LEFT JOIN users u
                    ON u.id=d.user_id

                WHERE d.id=$1

                LIMIT 1
                `,

                [id]

            );


        if (
            !result.rows.length
        ) {

            return error(
                res,
                "Demande de paiement introuvable.",
                404
            );

        }


        return success(
            res,
            result.rows[0],
            "Demande de paiement trouvée"
        );

    } catch (err) {

        return error(
            res,
            "Impossible de charger la demande de paiement.",
            500,
            err.message
        );

    }

}


app.get(
    "/api/demandes-paiement/:id",
    getPaymentRequestById
);


app.get(
    "/api/admin/demandes-paiement/:id",
    adminAuth,
    getPaymentRequestById
);


/* ============================================================
   53. VALIDATION DEMANDE DE PAIEMENT
============================================================ */

async function validatePaymentRequest(
    req,
    res
) {

    const client =
        await pool.connect();


    try {

        await client.query(
            "BEGIN"
        );


        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            await client.query(
                "ROLLBACK"
            );

            return error(
                res,
                "ID de demande invalide.",
                400
            );

        }


        const demandeResult =
            await client.query(

                `
                SELECT *
                FROM demandes_paiement
                WHERE id=$1
                FOR UPDATE
                `,

                [id]

            );


        if (
            !demandeResult.rows.length
        ) {

            await client.query(
                "ROLLBACK"
            );

            return error(
                res,
                "Demande de paiement introuvable.",
                404
            );

        }


        const demande =
            demandeResult.rows[0];


        const status =
            String(
                demande.status ||
                "pending"
            ).toLowerCase();


        if (
            status === "validated"
        ) {

            await client.query(
                "ROLLBACK"
            );

            return error(
                res,
                "Cette demande est déjà validée.",
                409
            );

        }


        if (
            status === "refused"
        ) {

            await client.query(
                "ROLLBACK"
            );

            return error(
                res,
                "Cette demande a déjà été refusée.",
                409
            );

        }


        const userId =
            parseId(
                demande.user_id
            );


        if (!userId) {

            await client.query(
                "ROLLBACK"
            );

            return error(
                res,
                "Cette demande n'est associée à aucun utilisateur.",
                400
            );

        }


        const userResult =
            await client.query(

                `
                SELECT *
                FROM users
                WHERE id=$1
                FOR UPDATE
                `,

                [userId]

            );


        if (
            !userResult.rows.length
        ) {

            await client.query(
                "ROLLBACK"
            );

            return error(
                res,
                "Utilisateur associé introuvable.",
                404
            );

        }


        const user =
            userResult.rows[0];


        if (
            user.blocked === true ||
            user.is_blocked === true
        ) {

            await client.query(
                "ROLLBACK"
            );

            return error(
                res,
                "Impossible d'activer Premium pour un utilisateur bloqué.",
                403
            );

        }


        const days =
            30;


        const now =
            new Date();

        let baseDate =
            now;


        if (
            user.premium_until
        ) {

            const current =
                new Date(
                    user.premium_until
                );


            if (
                current > now
            ) {

                baseDate =
                    current;

            }

        }


        const newPremiumUntil =
            new Date(
                baseDate
            );


        newPremiumUntil.setDate(
            newPremiumUntil.getDate() +
            days
        );


        await client.query(

            `
            UPDATE users
            SET
                premium=true,
                is_premium=true,
                premium_until=$1,
                updated_at=CURRENT_TIMESTAMP
            WHERE id=$2
            `,

            [
                newPremiumUntil,
                userId
            ]

        );


        const updated =
            await client.query(

                `
                UPDATE demandes_paiement
                SET
                    status='validated',
                    validated_at=CURRENT_TIMESTAMP,
                    refused_at=NULL,
                    refusal_reason=NULL,
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=$1
                RETURNING *
                `,

                [id]

            );


        await client.query(
            "COMMIT"
        );


        await logActivity(
            "VALIDATE_PAYMENT_REQUEST",
            `Demande ${id} validée - Premium activé pour utilisateur ${userId}`,
            userId
        );


        return success(
            res,
            {
                demande:
                    updated.rows[0],

                user_id:
                    userId,

                premium:
                    true,

                is_premium:
                    true,

                premium_until:
                    newPremiumUntil,

                premium_days:
                    days
            },
            "Demande validée et Premium activé"
        );

    } catch (err) {

        try {

            await client.query(
                "ROLLBACK"
            );

        } catch {}


        return error(
            res,
            "Impossible de valider la demande de paiement.",
            500,
            err.message
        );

    } finally {

        client.release();

    }

}


app.patch(
    "/api/admin/demandes-paiement/:id/valider",
    adminAuth,
    validatePaymentRequest
);


/* ============================================================
   54. REFUSER DEMANDE
============================================================ */

async function refusePaymentRequest(
    req,
    res
) {

    try {

        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            return error(
                res,
                "ID de demande invalide.",
                400
            );

        }


        const reason =
            cleanText(

                req.body?.reason ||
                req.body?.motif ||
                req.body?.refusal_reason ||
                "Demande de paiement refusée par l'administrateur",

                1000

            );


        const result =
            await pool.query(

                `
                UPDATE demandes_paiement
                SET
                    status='refused',
                    refusal_reason=$1,
                    refused_at=CURRENT_TIMESTAMP,
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=$2
                AND LOWER(
                    COALESCE(status,'pending')
                ) <> 'validated'
                RETURNING *
                `,

                [
                    reason,
                    id
                ]

            );


        if (
            !result.rows.length
        ) {

            const check =
                await pool.query(

                    `
                    SELECT id,status
                    FROM demandes_paiement
                    WHERE id=$1
                    `,

                    [id]

                );


            if (
                !check.rows.length
            ) {

                return error(
                    res,
                    "Demande de paiement introuvable.",
                    404
                );

            }


            return error(
                res,
                "Une demande déjà validée ne peut pas être refusée.",
                409
            );

        }


        const demande =
            result.rows[0];


        await logActivity(
            "REFUSE_PAYMENT_REQUEST",
            `Demande ${id} refusée : ${reason}`,
            demande.user_id
        );


        return success(
            res,
            demande,
            "Demande de paiement refusée"
        );

    } catch (err) {

        return error(
            res,
            "Impossible de refuser la demande de paiement.",
            500,
            err.message
        );

    }

}


app.patch(
    "/api/admin/demandes-paiement/:id/refuser",
    adminAuth,
    refusePaymentRequest
);


/* ============================================================
   55. DASHBOARD ADMIN
============================================================ */

app.get(
    "/api/admin/dashboard",
    adminAuth,
    async function(req, res) {

        try {

            const result =
                await pool.query(

                    `
                    SELECT

                        (
                            SELECT COUNT(*)
                            FROM users
                        )::int
                        AS utilisateurs,

                        (
                            SELECT COUNT(*)
                            FROM users
                            WHERE
                                premium=true
                                OR
                                is_premium=true
                        )::int
                        AS premium,

                        (
                            SELECT COUNT(*)
                            FROM users
                            WHERE
                                blocked=true
                                OR
                                is_blocked=true
                        )::int
                        AS bloques,

                        (
                            SELECT COUNT(*)
                            FROM paiements
                        )::int
                        AS paiements,

                        (
                            SELECT COUNT(*)
                            FROM paiements
                            WHERE LOWER(status)
                            IN (
                                'pending',
                                'en_attente',
                                'attente'
                            )
                        )::int
                        AS en_attente,

                        (
                            SELECT COUNT(*)
                            FROM paiements
                            WHERE LOWER(status)
                            ='validated'
                        )::int
                        AS valides,

                        (
                            SELECT COUNT(*)
                            FROM paiements
                            WHERE LOWER(status)
                            ='refused'
                        )::int
                        AS refuses,

                        (
                            SELECT COUNT(*)
                            FROM demandes_paiement
                        )::int
                        AS demandes_paiement,

                        (
                            SELECT COUNT(*)
                            FROM demandes_paiement
                            WHERE LOWER(
                                COALESCE(
                                    status,
                                    'pending'
                                )
                            )='pending'
                        )::int
                        AS demandes_en_attente,

                        (
                            SELECT COUNT(*)
                            FROM demandes_paiement
                            WHERE LOWER(
                                COALESCE(
                                    status,
                                    'pending'
                                )
                            )='validated'
                        )::int
                        AS demandes_validees,

                        (
                            SELECT COUNT(*)
                            FROM demandes_paiement
                            WHERE LOWER(
                                COALESCE(
                                    status,
                                    'pending'
                                )
                            )='refused'
                        )::int
                        AS demandes_refusees,

                        (
                            SELECT COALESCE(
                                SUM(amount),
                                0
                            )
                            FROM paiements
                            WHERE LOWER(status)
                            ='validated'
                        )
                        AS revenus,

                        (
                            SELECT COUNT(*)
                            FROM messages
                        )::int
                        AS messages,

                        (
                            SELECT COUNT(*)
                            FROM messages
                            WHERE LOWER(
                                COALESCE(
                                    status,
                                    'sent'
                                )
                            )='sent'
                        )::int
                        AS messages_envoyes

                    `
                );


            const recent =
                await pool.query(

                    `
                    SELECT
                        p.*,

                        u.nom
                            AS user_nom_db,

                        u.email
                            AS user_email_db,

                        u.telephone
                            AS user_telephone_db

                    FROM paiements p

                    LEFT JOIN users u
                        ON u.id=p.user_id

                    ORDER BY
                        p.created_at DESC

                    LIMIT 10
                    `

                );


            const recentDemandes =
                await pool.query(

                    `
                    SELECT
                        d.*,

                        u.nom
                            AS user_nom,

                        u.email
                            AS user_email,

                        u.telephone
                            AS user_telephone

                    FROM demandes_paiement d

                    LEFT JOIN users u
                        ON u.id=d.user_id

                    ORDER BY
                        d.created_at DESC

                    LIMIT 10
                    `

                );


            const stats =
                result.rows[0];


            return success(
                res,
                {

                    utilisateurs:
                        Number(
                            stats.utilisateurs
                        ),

                    users:
                        Number(
                            stats.utilisateurs
                        ),

                    premium:
                        Number(
                            stats.premium
                        ),

                    bloques:
                        Number(
                            stats.bloques
                        ),

                    utilisateurs_bloques:
                        Number(
                            stats.bloques
                        ),

                    paiements:
                        Number(
                            stats.paiements
                        ),

                    pending:
                        Number(
                            stats.en_attente
                        ),

                    paiements_en_attente:
                        Number(
                            stats.en_attente
                        ),

                    valides:
                        Number(
                            stats.valides
                        ),

                    refuses:
                        Number(
                            stats.refuses
                        ),

                    revenus:
                        stats.revenus,

                    demandes_paiement:
                        Number(
                            stats.demandes_paiement
                        ),

                    demandes_en_attente:
                        Number(
                            stats.demandes_en_attente
                        ),

                    demandes_validees:
                        Number(
                            stats.demandes_validees
                        ),

                    demandes_refusees:
                        Number(
                            stats.demandes_refusees
                        ),

                    messages:
                        Number(
                            stats.messages
                        ),

                    messages_envoyes:
                        Number(
                            stats.messages_envoyes
                        ),

                    paiements_recents:
                        recent.rows,

                    demandes_paiement_recentes:
                        recentDemandes.rows

                },
                "Tableau de bord chargé"
            );

        } catch (err) {

            return error(
                res,
                "Impossible de charger le tableau de bord.",
                500,
                err.message
            );

        }

    }
);


/* ============================================================
   56. STATISTIQUES
============================================================ */

async function statistics(
    req,
    res
) {

    try {

        const result =
            await pool.query(

                `
                SELECT

                    (
                        SELECT COUNT(*)
                        FROM users
                    )::int
                    AS utilisateurs,

                    (
                        SELECT COUNT(*)
                        FROM users
                        WHERE
                            premium=true
                            OR
                            is_premium=true
                    )::int
                    AS premium,

                    (
                        SELECT COUNT(*)
                        FROM users
                        WHERE
                            blocked=true
                            OR
                            is_blocked=true
                    )::int
                    AS bloques,

                    (
                        SELECT COUNT(*)
                        FROM paiements
                    )::int
                    AS paiements,

                    (
                        SELECT COUNT(*)
                        FROM paiements
                        WHERE LOWER(status)
                        IN (
                            'pending',
                            'en_attente',
                            'attente'
                        )
                    )::int
                    AS en_attente,

                    (
                        SELECT COUNT(*)
                        FROM paiements
                        WHERE LOWER(status)
                        ='validated'
                    )::int
                    AS valides,

                    (
                        SELECT COUNT(*)
                        FROM paiements
                        WHERE LOWER(status)
                        ='refused'
                    )::int
                    AS refuses,

                    (
                        SELECT COUNT(*)
                        FROM demandes_paiement
                    )::int
                    AS demandes_paiement,

                    (
                        SELECT COUNT(*)
                        FROM demandes_paiement
                        WHERE LOWER(
                            COALESCE(
                                status,
                                'pending'
                            )
                        )='pending'
                    )::int
                    AS demandes_en_attente,

                    (
                        SELECT COUNT(*)
                        FROM demandes_paiement
                        WHERE LOWER(
                            COALESCE(
                                status,
                                'pending'
                            )
                        )='validated'
                    )::int
                    AS demandes_validees,

                    (
                        SELECT COUNT(*)
                        FROM demandes_paiement
                        WHERE LOWER(
                            COALESCE(
                                status,
                                'pending'
                            )
                        )='refused'
                    )::int
                    AS demandes_refusees,

                    (
                        SELECT COALESCE(
                            SUM(amount),
                            0
                        )
                        FROM paiements
                        WHERE LOWER(status)
                        ='validated'
                    )
                    AS revenus

                `
            );


        const s =
            result.rows[0];


        return success(
            res,
            {

                utilisateurs:
                    Number(
                        s.utilisateurs
                    ),

                premium:
                    Number(
                        s.premium
                    ),

                bloques:
                    Number(
                        s.bloques
                    ),

                paiements:
                    Number(
                        s.paiements
                    ),

                en_attente:
                    Number(
                        s.en_attente
                    ),

                valides:
                    Number(
                        s.valides
                    ),

                refuses:
                    Number(
                        s.refuses
                    ),

                demandes_paiement:
                    Number(
                        s.demandes_paiement
                    ),

                demandes_en_attente:
                    Number(
                        s.demandes_en_attente
                    ),

                demandes_validees:
                    Number(
                        s.demandes_validees
                    ),

                demandes_refusees:
                    Number(
                        s.demandes_refusees
                    ),

                revenus:
                    s.revenus

            },
            "Statistiques chargées"
        );

    } catch (err) {

        return error(
            res,
            "Impossible de charger les statistiques.",
            500,
            err.message
        );

    }

}


app.get(
    "/api/admin/statistiques",
    adminAuth,
    statistics
);


app.get(
    "/api/statistiques",
    statistics
);


/* ============================================================
   57. LISTE DES ROUTES
============================================================ */

const ROUTES = [

    "GET /",
    "GET /api",
    "GET /api/health",
    "GET /api/test-db",

    "POST /api/admin/login",

    "POST /api/inscription",
    "POST /api/register",
    "POST /api/signup",

    "POST /api/connexion",
    "POST /api/login",
    "POST /api/signin",

    "GET /api/utilisateurs",
    "GET /api/utilisateurs/:id",

    "POST /api/utilisateurs",

    "PUT /api/utilisateurs/:id",
    "PATCH /api/utilisateurs/:id",

    "DELETE /api/utilisateurs/:id",

    "GET /api/admin/utilisateurs",
    "GET /api/admin/users",

    "PATCH /api/admin/users/:id/premium",
    "PATCH /api/admin/users/:id/block",

    "GET /api/paiements",
    "GET /api/paiements/:id",
    "POST /api/paiements",
    "PATCH /api/paiements/:id",
    "DELETE /api/paiements/:id",

    "PATCH /api/paiements/:id/valider",
    "PATCH /api/paiements/:id/refuser",

    "GET /api/admin/paiements",
    "GET /api/admin/payments",

    "POST /api/demandes-paiement",
    "GET /api/demandes-paiement",
    "GET /api/demandes-paiement/:id",

    "PATCH /api/admin/demandes-paiement/:id/valider",
    "PATCH /api/admin/demandes-paiement/:id/refuser",

    "GET /api/messages",
    "GET /api/messages/reponses",
    "POST /api/messages/send-user",
    "POST /api/messages/send-official",
    "POST /api/messages/send-all",
    "POST /api/messages/send-standard",
    "POST /api/messages/send-premium",

    "GET /api/utilisateurs/:userId/messages",
    "GET /api/utilisateurs/:userId/messages/stream",

    "GET /api/admin/messages/user/:userId",

    "GET /api/admin/dashboard",
    "GET /api/admin/statistiques"

];


/* ============================================================
   58. ROUTE 404
============================================================ */

app.use(
    function(req, res) {

        return res
            .status(404)
            .json({

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


/* ============================================================
   59. GESTIONNAIRE GLOBAL D'ERREURS
============================================================ */

app.use(
    function(
        err,
        req,
        res,
        next
    ) {

        console.error(
            "Erreur serveur :",
            err
        );


        if (
            res.headersSent
        ) {

            return next(err);

        }


        return res
            .status(500)
            .json({

                success: false,

                message:
                    "Erreur interne du serveur.",

                error:
                    process.env.NODE_ENV ===
                    "production"
                        ? undefined
                        : err.message

            });

    }
);


/* ============================================================
   60. ARRÊT PROPRE
============================================================ */

let server = null;


async function gracefulShutdown(
    signal
) {

    console.log(
        `${signal} reçu. Arrêt du serveur...`
    );


    try {

        if (server) {

            await new Promise(
                function(resolve) {

                    server.close(
                        function() {

                            resolve();

                        }
                    );

                }
            );

        }


        await pool.end();


        console.log(
            "✓ Connexion PostgreSQL fermée."
        );


        process.exit(0);

    } catch (err) {

        console.error(
            "Erreur arrêt serveur :",
            err
        );


        process.exit(1);

    }

}


process.on(
    "SIGTERM",
    function() {

        gracefulShutdown(
            "SIGTERM"
        );

    }
);


process.on(
    "SIGINT",
    function() {

        gracefulShutdown(
            "SIGINT"
        );

    }
);


/* ============================================================
   61. ERREURS NON CAPTURÉES
============================================================ */

process.on(
    "unhandledRejection",
    function(reason) {

        console.error(
            "Unhandled Promise Rejection :",
            reason
        );

    }
);


process.on(
    "uncaughtException",
    function(err) {

        console.error(
            "Uncaught Exception :",
            err
        );

    }
);


/* ============================================================
   62. DÉMARRAGE SERVEUR
============================================================ */

async function startServer() {

    try {

        if (!DATABASE_URL) {

            throw new Error(
                "DATABASE_URL est absente des variables d'environnement."
            );

        }


        /*
         * Vérification PostgreSQL.
         */

        await testDatabase();


        console.log(
            "✓ Connexion PostgreSQL réussie."
        );


        /*
         * Création / migration des tables.
         */

        await initDatabase();


        /*
         * Démarrage Express.
         */

        server =
            app.listen(

                PORT,

                "0.0.0.0",

                function() {

                    console.log("");
                    console.log(
                        "=================================================="
                    );

                    console.log(
                        "          BMJ SERVICE BACKEND"
                    );

                    console.log(
                        "          VERSION : 14.0.0"
                    );

                    console.log(
                        `          PORT : ${PORT}`
                    );

                    console.log(
                        "          DATABASE : PostgreSQL"
                    );

                    console.log(
                        "          SERVER : Render"
                    );

                    console.log(
                        "          STATUS : ONLINE"
                    );

                    console.log(
                        "=================================================="
                    );

                    console.log(
                        `ADMIN EMAIL : ${ADMIN_EMAIL}`
                    );

                    console.log(
                        "=================================================="
                    );

                    console.log(
                        `TOTAL ROUTES : ${ROUTES.length}`
                    );

                    console.log(
                        "=================================================="
                    );

                    console.log(
                        "MESSAGERIE : ACTIVE"
                    );

                    console.log(
                        "SSE : ACTIVE"
                    );

                    console.log(
                        "PAIEMENTS : ACTIVE"
                    );

                    console.log(
                        "DEMANDES PAIEMENT : ACTIVE"
                    );

                    console.log(
                        "PREMIUM : ACTIVE"
                    );

                    console.log(
                        "=================================================="
                    );

                    console.log(
                        "POST /api/paiements"
                    );

                    console.log(
                        "POST /api/demandes-paiement"
                    );

                    console.log(
                        "GET /api/messages"
                    );

                    console.log(
                        "=================================================="
                    );

                }

            );


    } catch (err) {

        console.error("");

        console.error(
            "=================================================="
        );

        console.error(
            "❌ IMPOSSIBLE DE DÉMARRER BMJ SERVICE"
        );

        console.error(
            "=================================================="
        );

        console.error(
            err
        );

        console.error(
            "=================================================="
        );

        process.exit(1);

    }

}


/* ============================================================
   63. LANCEMENT
============================================================ */

startServer();