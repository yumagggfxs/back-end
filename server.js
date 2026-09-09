/* ============================================================
   BMJ SERVICE - BACKEND COMPLET
   Version : 14.0.0
   Node.js + Express + PostgreSQL
   Compatible Render / Aiven PostgreSQL
============================================================ */

"use strict";


/* ============================================================
   1. IMPORTATIONS
============================================================ */

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { Pool } = require("pg");


/* ============================================================
   2. APPLICATION EXPRESS
============================================================ */

const app = express();


/* ============================================================
   3. CONFIGURATION
============================================================ */

const PORT =
    Number(process.env.PORT) || 10000;


const ADMIN_EMAIL =
    process.env.ADMIN_EMAIL ||
    "admin@bmjservice.com";


const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD ||
    "change-this-admin-password";


const ADMIN_SECRET =
    process.env.ADMIN_SECRET ||
    "bmj-service-secret-change-me";


const PREMIUM_DAYS =
    Number(process.env.PREMIUM_DAYS) || 30;


/* ============================================================
   4. MIDDLEWARES
============================================================ */

app.use(
    cors({
        origin: true,
        credentials: true
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
    function (req, res, next) {

        console.log(
            `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`
        );

        next();
    }
);


/* ============================================================
   6. CONNEXION POSTGRESQL
============================================================ */

if (!process.env.DATABASE_URL) {

    console.warn(
        "⚠️ DATABASE_URL n'est pas définie."
    );

}


const pool =
    new Pool({

        connectionString:
            process.env.DATABASE_URL,

        ssl:
            process.env.NODE_ENV === "production"
                ? {
                    rejectUnauthorized: false
                }
                : false,

        max: 10,

        idleTimeoutMillis: 30000,

        connectionTimeoutMillis: 10000
    });


pool.on(
    "error",
    function (err) {

        console.error(
            "❌ Erreur PostgreSQL inattendue :",
            err.message
        );

    }
);


/* ============================================================
   7. OUTILS
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
        String(value).toLowerCase() === "true"
    ) {

        return true;

    }

    return false;
}


function normalizeEmail(email) {

    if (
        email === undefined ||
        email === null
    ) {

        return null;

    }

    return String(email)
        .trim()
        .toLowerCase();

}


function success(
    res,
    data = null,
    message = "Opération réussie"
) {

    return res.status(200).json({

        success: true,

        message,

        data
    });

}


function error(
    res,
    message = "Une erreur est survenue.",
    status = 500,
    details = null
) {

    const response = {

        success: false,

        message
    };


    if (
        details &&
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
   8. JOURNAL ADMIN
============================================================ */

async function logActivity(
    action,
    details = null,
    userId = null,
    paymentId = null,
    req = null
) {

    try {

        await pool.query(

            `
            INSERT INTO admin_activity
            (
                admin_email,
                action,
                details,
                user_id,
                payment_id,
                ip,
                user_agent,
                created_at
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
                CURRENT_TIMESTAMP
            )
            `,

            [

                ADMIN_EMAIL,

                action,

                details,

                userId,

                paymentId,

                req
                    ? req.ip
                    : null,

                req
                    ? req.get("user-agent")
                    : null

            ]

        );

    } catch (err) {

        console.error(
            "⚠️ Journal admin :",
            err.message
        );

    }

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
            parts[2];


        if (
            email !== ADMIN_EMAIL ||
            !Number.isFinite(timestamp)
        ) {

            return false;

        }


        /*
           Token valable 24 heures.
        */

        if (
            Date.now() -
            timestamp >
            24 * 60 * 60 * 1000
        ) {

            return false;

        }


        const payload =
            `${email}:${timestamp}`;


        const expected =
            crypto
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

    } catch {

        return false;

    }

}


function adminAuth(
    req,
    res,
    next
) {

    let token = null;


    const authorization =
        req.headers.authorization;


    if (
        authorization &&
        authorization.startsWith("Bearer ")
    ) {

        token =
            authorization.substring(7);

    }


    if (!token) {

        token =
            req.query.token ||
            req.headers["x-admin-token"];

    }


    if (
        !verifyAdminToken(token)
    ) {

        return res.status(401).json({

            success: false,

            message:
                "Accès administrateur non autorisé."

        });

    }


    req.admin =
        true;


    req.admin_email =
        ADMIN_EMAIL;


    next();

}


/* ============================================================
   10. INITIALISATION BASE DE DONNÉES
============================================================ */

async function initDatabase() {

    console.log(
        "→ Initialisation PostgreSQL..."
    );


    /*
       TABLE USERS
    */

    await pool.query(

        `
        CREATE TABLE IF NOT EXISTS users
        (
            id SERIAL PRIMARY KEY,

            nom TEXT,

            email TEXT UNIQUE,

            telephone TEXT,

            domaine TEXT,

            password TEXT,

            photo TEXT,

            premium BOOLEAN DEFAULT FALSE,

            is_premium BOOLEAN DEFAULT FALSE,

            premium_until TIMESTAMPTZ,

            blocked BOOLEAN DEFAULT FALSE,

            is_blocked BOOLEAN DEFAULT FALSE,

            created_at TIMESTAMPTZ
                DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMPTZ
                DEFAULT CURRENT_TIMESTAMP
        )
        `

    );


    /*
       Colonnes de compatibilité
    */

    await pool.query(

        `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS premium BOOLEAN DEFAULT FALSE
        `

    );


    await pool.query(

        `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE
        `

    );


    await pool.query(

        `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ
        `

    );


    await pool.query(

        `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE
        `

    );


    await pool.query(

        `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE
        `

    );


    await pool.query(

        `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
            DEFAULT CURRENT_TIMESTAMP
        `

    );


    /*
       TABLE PAIEMENTS
    */

    await pool.query(

        `
        CREATE TABLE IF NOT EXISTS paiements
        (
            id SERIAL PRIMARY KEY,

            user_id INTEGER,

            nom TEXT,

            email TEXT,

            telephone TEXT,

            amount NUMERIC(12,2)
                DEFAULT 0,

            montant NUMERIC(12,2)
                DEFAULT 0,

            currency TEXT
                DEFAULT 'USD',

            methode TEXT,

            method TEXT,

            reference TEXT,

            transaction_id TEXT,

            preuve TEXT,

            proof TEXT,

            status TEXT
                DEFAULT 'pending',

            premium_days INTEGER
                DEFAULT 30,

            notes TEXT,

            refusal_reason TEXT,

            validated_at TIMESTAMPTZ,

            refused_at TIMESTAMPTZ,

            created_at TIMESTAMPTZ
                DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMPTZ
                DEFAULT CURRENT_TIMESTAMP
        )
        `

    );


    /*
       Colonnes paiements compatibles
    */

    const paymentColumns = [

        [
            "amount",
            "NUMERIC(12,2) DEFAULT 0"
        ],

        [
            "montant",
            "NUMERIC(12,2) DEFAULT 0"
        ],

        [
            "currency",
            "TEXT DEFAULT 'USD'"
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
            "TEXT DEFAULT 'pending'"
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
            "updated_at",
            "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"
        ]

    ];


    for (
        const [
            column,
            type
        ]
        of paymentColumns
    ) {

        await pool.query(

            `
            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS ${column} ${type}
            `

        );

    }


    /*
       TABLE DEMANDES DE PAIEMENT
    */

    await pool.query(

        `
        CREATE TABLE IF NOT EXISTS demandes_paiement
        (
            id SERIAL PRIMARY KEY,

            user_id INTEGER NOT NULL,

            telephone_paiement TEXT NOT NULL,

            reference_paiement TEXT NOT NULL,

            status TEXT
                DEFAULT 'pending',

            refusal_reason TEXT,

            validated_at TIMESTAMPTZ,

            refused_at TIMESTAMPTZ,

            created_at TIMESTAMPTZ
                DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMPTZ
                DEFAULT CURRENT_TIMESTAMP
        )
        `

    );


    /*
       Compatibilité ancienne table
    */

    const requestColumns = [

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
            "TEXT DEFAULT 'pending'"
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
            "updated_at",
            "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"
        ]

    ];


    for (
        const [
            column,
            type
        ]
        of requestColumns
    ) {

        await pool.query(

            `
            ALTER TABLE demandes_paiement
            ADD COLUMN IF NOT EXISTS ${column} ${type}
            `

        );

    }


    /*
       TABLE JOURNAL ADMIN
    */

    await pool.query(

        `
        CREATE TABLE IF NOT EXISTS admin_activity
        (
            id SERIAL PRIMARY KEY,

            admin_email TEXT,

            action TEXT NOT NULL,

            details TEXT,

            user_id INTEGER,

            payment_id INTEGER,

            ip TEXT,

            user_agent TEXT,

            created_at TIMESTAMPTZ
                DEFAULT CURRENT_TIMESTAMP
        )
        `

    );


    /*
       TABLE MESSAGES
    */

    await pool.query(

        `
        CREATE TABLE IF NOT EXISTS messages
        (
            id SERIAL PRIMARY KEY,

            sender_type TEXT
                DEFAULT 'admin',

            sender_user_id INTEGER,

            recipient_user_id INTEGER,

            recipient_type TEXT,

            subject TEXT,

            content TEXT NOT NULL,

            type TEXT
                DEFAULT 'standard',

            audience TEXT
                DEFAULT 'user',

            status TEXT
                DEFAULT 'unread',

            parent_message_id INTEGER,

            created_at TIMESTAMPTZ
                DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMPTZ
                DEFAULT CURRENT_TIMESTAMP,

            read_at TIMESTAMPTZ
        )
        `

    );


    /*
       INDEX
    */

    await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_users_email
         ON users(email)`
    );


    await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_users_premium
         ON users(premium)`
    );


    await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_users_blocked
         ON users(blocked)`
    );


    await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_paiements_user
         ON paiements(user_id)`
    );


    await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_paiements_status
         ON paiements(status)`
    );


    await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_demandes_user
         ON demandes_paiement(user_id)`
    );


    await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_demandes_status
         ON demandes_paiement(status)`
    );


    await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_messages_recipient
         ON messages(recipient_user_id)`
    );


    await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_messages_sender
         ON messages(sender_user_id)`
    );


    console.log(
        "✓ PostgreSQL initialisé."
    );

}


/* ============================================================
   11. ROUTE API PRINCIPALE
============================================================ */

app.get(
    "/api",
    function (req, res) {

        return res.json({

            success: true,

            message:
                "BMJ SERVICE API fonctionne.",

            version:
                "14.0.0",

            server:
                "Render",

            database:
                "PostgreSQL",

            endpoints: {

                health:
                    "/api/health",

                login:
                    "/api/admin/login",

                users:
                    "/api/utilisateurs",

                paymentRequests:
                    "/api/demandes-paiement",

                statistics:
                    "/api/statistiques",

                messages:
                    "/api/messages"

            }

        });

    }
);


/* ============================================================
   12. CONNEXION ADMIN
============================================================ */

app.post(
    "/api/admin/login",
    async function (req, res) {

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
                email !==
                normalizeEmail(
                    ADMIN_EMAIL
                )
            ) {

                return error(
                    res,
                    "Identifiants administrateur incorrects.",
                    401
                );

            }


            if (
                password !==
                ADMIN_PASSWORD
            ) {

                return error(
                    res,
                    "Identifiants administrateur incorrects.",
                    401
                );

            }


            const token =
                createAdminToken();


            await logActivity(
                "ADMIN_LOGIN",
                "Connexion administrateur"
            );


            return success(

                res,

                {

                    token,

                    admin: {

                        email:
                            ADMIN_EMAIL

                    }

                },

                "Connexion administrateur réussie"

            );

        } catch (err) {

            return error(
                res,
                "Impossible de connecter l'administrateur.",
                500,
                err.message
            );

        }

    }
);


/* ============================================================
   13. HEALTH CHECK
============================================================ */

app.get(
    "/api/health",
    async function (req, res) {

        try {

            await pool.query(
                "SELECT 1"
            );


            return res.status(200).json({

                success: true,

                status:
                    "healthy",

                server:
                    "BMJ SERVICE",

                database:
                    "connected",

                timestamp:
                    new Date().toISOString(),

                uptime:
                    process.uptime()

            });

        } catch (err) {

            return res.status(503).json({

                success: false,

                status:
                    "unhealthy",

                server:
                    "BMJ SERVICE",

                database:
                    "disconnected",

                timestamp:
                    new Date().toISOString(),

                error:
                    err.message

            });

        }

    }
);


/* ============================================================
   14. CRÉATION UTILISATEUR
============================================================ */

async function registerUser(req, res) {

    try {

        const body =
            req.body || {};


        const nom =
            String(
                body.nom || ""
            ).trim();


        const email =
            normalizeEmail(
                body.email
            );


        const telephone =
            String(
                body.telephone || ""
            ).trim();


        const domaine =
            String(
                body.domaine || ""
            ).trim();


        const password =
            body.password ||
            null;


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


        if (!email) {

            return error(
                res,
                "L'adresse email est obligatoire.",
                400
            );

        }


        const emailExists =
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
            emailExists.rows.length
        ) {

            return error(
                res,
                "Cette adresse email existe déjà.",
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
                    is_blocked,
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
                    false,
                    false,
                    false,
                    false,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
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
                    created_at,
                    updated_at
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


        await logActivity(

            "CREATE_USER",

            `Utilisateur ${result.rows[0].id} créé`,

            result.rows[0].id,

            null,

            req

        );


        return success(

            res,

            result.rows[0],

            "Utilisateur créé avec succès"

        );

    } catch (err) {

        return error(
            res,
            "Impossible de créer l'utilisateur.",
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


/* ============================================================
   15. LISTE UTILISATEURS ADMIN
============================================================ */

async function getAdminUsers(req, res) {

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

                ORDER BY
                    created_at DESC
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
   16. UTILISATEURS PUBLICS
============================================================ */

async function getUsersPublic(req, res) {

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

                ORDER BY
                    created_at DESC
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
   17. UTILISATEUR PAR ID
============================================================ */

async function getUserById(req, res) {

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


        if (!result.rows.length) {

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
   18. MODIFICATION UTILISATEUR
============================================================ */

async function updateUser(req, res) {

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
                ? String(body.nom).trim()
                : null;


        const email =
            body.email !== undefined
                ? normalizeEmail(body.email)
                : null;


        const telephone =
            body.telephone !== undefined
                ? String(body.telephone).trim()
                : null;


        const domaine =
            body.domaine !== undefined
                ? String(body.domaine).trim()
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


            if (check.rows.length) {

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

                    nom =
                        COALESCE($1, nom),

                    email =
                        COALESCE($2, email),

                    telephone =
                        COALESCE($3, telephone),

                    domaine =
                        COALESCE($4, domaine),

                    photo =
                        COALESCE($5, photo),

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id=$6

                RETURNING *

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


        if (!result.rows.length) {

            return error(
                res,
                "Utilisateur introuvable.",
                404
            );

        }


        await logActivity(

            "UPDATE_USER",

            `Utilisateur ${id} modifié`,

            id,

            null,

            req

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
   19. SUPPRESSION UTILISATEUR
============================================================ */

async function deleteUser(req, res) {

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
           On conserve l'historique des paiements.
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
           Les demandes sont également conservées.
        */

        await pool.query(

            `
            UPDATE demandes_paiement

            SET user_id=NULL

            WHERE user_id=$1
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


        if (!result.rows.length) {

            return error(
                res,
                "Utilisateur introuvable.",
                404
            );

        }


        await logActivity(

            "DELETE_USER",

            `Utilisateur ${id} supprimé`,

            null,
            null,
            req

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
   20. PAIEMENTS EXISTANTS
============================================================ */

async function getPayments(req, res) {

    try {

        const result =
            await pool.query(

                `
                SELECT

                    p.*,

                    u.nom AS user_nom_db,

                    u.email AS user_email_db,

                    u.telephone AS user_telephone_db

                FROM paiements p

                LEFT JOIN users u
                    ON u.id=p.user_id

                ORDER BY
                    p.created_at DESC
                `

            );


        const data =
            result.rows.map(
                function (payment) {

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
   21. PAIEMENT PAR ID
============================================================ */

async function getPaymentById(req, res) {

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

                    u.nom AS user_nom_db,

                    u.email AS user_email_db,

                    u.telephone AS user_telephone_db

                FROM paiements p

                LEFT JOIN users u
                    ON u.id=p.user_id

                WHERE p.id=$1

                `,

                [id]

            );


        if (!result.rows.length) {

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
   22. CRÉER PAIEMENT EXISTANT
============================================================ */

async function createPayment(req, res) {

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
            body.currency ||
            "USD";


        const method =
            body.method ||
            body.methode ||
            body.mode_paiement ||
            null;


        const reference =
            body.reference ||
            body.transaction_id ||
            body.transactionId ||
            null;


        const proof =
            body.proof ||
            body.preuve ||
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
                    `,

                    [userId]

                );


            if (!userResult.rows.length) {

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
                PREMIUM_DAYS
            );


        if (
            !Number.isInteger(premiumDays) ||
            premiumDays <= 0
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
                    method,
                    reference,
                    proof,
                    premiumDays,
                    body.notes || null

                ]

            );


        const payment =
            result.rows[0];


        await logActivity(

            "CREATE_PAYMENT",

            `Paiement ${payment.id} créé`,

            userId,
            payment.id,
            req

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


/* ============================================================
   23. VALIDATION PAIEMENT EXISTANT
============================================================ */

async function validatePayment(req, res) {

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


        if (!paymentResult.rows.length) {

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


        if (
            String(payment.status)
                .toLowerCase() ===
            "validated"
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


        if (!userResult.rows.length) {

            await client.query(
                "ROLLBACK"
            );

            return error(
                res,
                "Utilisateur introuvable.",
                404
            );

        }


        const user =
            userResult.rows[0];


        const days =
            Number(
                payment.premium_days ||
                PREMIUM_DAYS
            );


        const now =
            new Date();


        let base =
            now;


        if (user.premium_until) {

            const current =
                new Date(
                    user.premium_until
                );


            if (
                current > now
            ) {

                base =
                    current;

            }

        }


        const premiumUntil =
            new Date(base);


        premiumUntil.setDate(
            premiumUntil.getDate() +
            days
        );


        await client.query(

            `
            UPDATE users

            SET

                premium=true,

                is_premium=true,

                premium_until=$1,

                updated_at=
                    CURRENT_TIMESTAMP

            WHERE id=$2
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

                    status='validated',

                    validated_at=
                        CURRENT_TIMESTAMP,

                    updated_at=
                        CURRENT_TIMESTAMP

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
            id,
            req

        );


        return success(

            res,

            {

                payment:
                    updated.rows[0],

                user_id:
                    userId,

                premium:
                    true,

                is_premium:
                    true,

                premium_until:
                    premiumUntil,

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

        } catch (_) {}


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
   24. REFUS PAIEMENT EXISTANT
============================================================ */

async function refusePayment(req, res) {

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
            String(
                req.body?.reason ||
                req.body?.motif ||
                req.body?.refusal_reason ||
                "Paiement refusé par l'administrateur"
            ).trim();


        const result =
            await pool.query(

                `
                UPDATE paiements

                SET

                    status='refused',

                    refusal_reason=$1,

                    refused_at=
                        CURRENT_TIMESTAMP,

                    updated_at=
                        CURRENT_TIMESTAMP

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


        if (!result.rows.length) {

            return error(
                res,
                "Paiement introuvable ou déjà validé.",
                409
            );

        }


        const payment =
            result.rows[0];


        await logActivity(

            "REFUSE_PAYMENT",

            `Paiement ${id} refusé : ${reason}`,

            payment.user_id,
            id,
            req

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
   25. DEMANDE DE PAIEMENT
============================================================ */

/*
   POST /api/demandes-paiement

   BODY :

   {
       "user_id": 12,
       "telephone_paiement": "0991234567",
       "reference_paiement": "ABC123456"
   }

   Cette route NE dépend PAS de /api/paiements.
*/


async function createPaymentRequest(req, res) {

    try {

        const body =
            req.body || {};


        const userId =
            parseId(
                body.user_id ??
                body.userId
            );


        const telephonePaiement =
            String(

                body.telephone_paiement ??
                body.telephonePaiement ??
                body.numero_paiement ??
                body.numeroPaiement ??
                ""

            ).trim();


        const referencePaiement =
            String(

                body.reference_paiement ??
                body.referencePaiement ??
                body.reference ??
                ""

            ).trim();


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
            telephonePaiement.length < 6 ||
            telephonePaiement.length > 100
        ) {

            return error(
                res,
                "Numéro de paiement invalide.",
                400
            );

        }


        if (
            referencePaiement.length < 2 ||
            referencePaiement.length > 255
        ) {

            return error(
                res,
                "Référence de paiement invalide.",
                400
            );

        }


        /*
           Vérification utilisateur
        */

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


        if (!userResult.rows.length) {

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


        /*
           Une seule demande en attente.
        */

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


        if (pending.rows.length) {

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


        /*
           Référence unique.
        */

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


        if (referenceUsed.rows.length) {

            return error(
                res,
                "Cette référence de paiement a déjà été utilisée.",
                409
            );

        }


        /*
           Création demande.
        */

        const result =
            await pool.query(

                `
                INSERT INTO demandes_paiement
                (
                    user_id,
                    telephone_paiement,
                    reference_paiement,
                    status,
                    created_at,
                    updated_at
                )

                VALUES
                (
                    $1,
                    $2,
                    $3,
                    'pending',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
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

            `Demande de paiement ${demande.id} créée`,

            userId,
            null,
            req

        );


        return res.status(201).json({

            success: true,

            message:
                "Votre demande de paiement a été enregistrée.",

            data: {

                ...demande,

                user: {

                    id:
                        user.id,

                    nom:
                        user.nom,

                    email:
                        user.email

                }

            }

        });

    } catch (err) {

        console.error(
            "Erreur demande paiement :",
            err
        );


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
   26. LISTE DEMANDES DE PAIEMENT
============================================================ */

async function getPaymentRequests(req, res) {

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

                    u.nom AS user_nom,

                    u.email AS user_email,

                    u.telephone AS user_telephone,

                    u.domaine AS user_domaine,

                    u.premium AS user_premium,

                    u.is_premium AS user_is_premium,

                    u.premium_until AS user_premium_until

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
   27. DEMANDE DE PAIEMENT PAR ID
============================================================ */

async function getPaymentRequestById(req, res) {

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

                    u.nom AS user_nom,

                    u.email AS user_email,

                    u.telephone AS user_telephone,

                    u.domaine AS user_domaine,

                    u.premium AS user_premium,

                    u.is_premium AS user_is_premium,

                    u.premium_until AS user_premium_until

                FROM demandes_paiement d

                LEFT JOIN users u
                    ON u.id=d.user_id

                WHERE d.id=$1

                LIMIT 1
                `,

                [id]

            );


        if (!result.rows.length) {

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
   28. VALIDATION DEMANDE DE PAIEMENT
============================================================ */

async function validatePaymentRequest(req, res) {

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


        /*
           Verrouillage de la demande
        */

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


        if (!demandeResult.rows.length) {

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


        /*
           Verrouillage utilisateur
        */

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


        if (!userResult.rows.length) {

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


        /*
           Durée Premium
        */

        const days =
            PREMIUM_DAYS;


        /*
           PostgreSQL calcule directement
           la nouvelle date.
        */

        const premiumResult =
            await client.query(

                `
                UPDATE users

                SET

                    premium=true,

                    is_premium=true,

                    premium_until=

                        CASE

                            WHEN premium_until IS NOT NULL
                            AND premium_until > CURRENT_TIMESTAMP

                            THEN premium_until
                                 + ($1 * INTERVAL '1 day')

                            ELSE CURRENT_TIMESTAMP
                                 + ($1 * INTERVAL '1 day')

                        END,

                    updated_at=
                        CURRENT_TIMESTAMP

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
                    days,
                    userId
                ]

            );


        /*
           Validation demande
        */

        const updated =
            await client.query(

                `
                UPDATE demandes_paiement

                SET

                    status='validated',

                    validated_at=
                        CURRENT_TIMESTAMP,

                    refused_at=NULL,

                    refusal_reason=NULL,

                    updated_at=
                        CURRENT_TIMESTAMP

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

            `Demande ${id} validée - Premium activé pendant ${days} jours`,

            userId,
            null,
            req

        );


        return success(

            res,

            {

                demande:
                    updated.rows[0],

                user:
                    premiumResult.rows[0],

                user_id:
                    userId,

                premium:
                    true,

                is_premium:
                    true,

                premium_until:
                    premiumResult.rows[0]
                        .premium_until,

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

        } catch (_) {}


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
   29. REFUS DEMANDE DE PAIEMENT
============================================================ */

async function refusePaymentRequest(req, res) {

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
            String(

                req.body?.reason ||
                req.body?.motif ||
                req.body?.refusal_reason ||
                "Demande de paiement refusée par l'administrateur"

            ).trim();


        const result =
            await pool.query(

                `
                UPDATE demandes_paiement

                SET

                    status='refused',

                    refusal_reason=$1,

                    refused_at=
                        CURRENT_TIMESTAMP,

                    updated_at=
                        CURRENT_TIMESTAMP

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


        if (!result.rows.length) {

            const check =
                await pool.query(

                    `
                    SELECT
                        id,
                        status
                    FROM demandes_paiement
                    WHERE id=$1
                    `,

                    [id]

                );


            if (!check.rows.length) {

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

            demande.user_id,
            null,
            req

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
   30. PREMIUM MANUEL ADMIN
============================================================ */

app.patch(
    "/api/admin/users/:id/premium",
    adminAuth,
    async function (req, res) {

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


            let enabled =
                true;


            if (
                body.enabled !== undefined
            ) {

                enabled =
                    getBoolean(
                        body.enabled
                    );

            }

            else if (
                body.premium !== undefined
            ) {

                enabled =
                    getBoolean(
                        body.premium
                    );

            }

            else if (
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
                    PREMIUM_DAYS
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
                    `,

                    [id]

                );


            if (!userResult.rows.length) {

                return error(
                    res,
                    "Utilisateur introuvable.",
                    404
                );

            }


            if (!enabled) {

                const result =
                    await pool.query(

                        `
                        UPDATE users

                        SET

                            premium=false,

                            is_premium=false,

                            premium_until=NULL,

                            updated_at=
                                CURRENT_TIMESTAMP

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

                    id,
                    null,
                    req

                );


                return success(

                    res,

                    {

                        ...result.rows[0],

                        premium_days:
                            0

                    },

                    "Le statut Premium a été retiré."

                );

            }


            const result =
                await pool.query(

                    `
                    UPDATE users

                    SET

                        premium=true,

                        is_premium=true,

                        premium_until=

                            CASE

                                WHEN premium_until IS NOT NULL
                                AND premium_until > CURRENT_TIMESTAMP

                                THEN premium_until
                                     + ($1 * INTERVAL '1 day')

                                ELSE CURRENT_TIMESTAMP
                                     + ($1 * INTERVAL '1 day')

                            END,

                        updated_at=
                            CURRENT_TIMESTAMP

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
                        days,
                        id
                    ]

                );


            await logActivity(

                "ENABLE_PREMIUM",

                `Premium activé pour utilisateur ${id} pendant ${days} jours`,

                id,
                null,
                req

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
                "Impossible de modifier Premium.",
                500,
                err.message
            );

        }

    }
);


/* ============================================================
   31. BLOQUER / DÉBLOQUER UTILISATEUR
============================================================ */

app.patch(
    "/api/admin/users/:id/block",
    adminAuth,
    async function (req, res) {

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

                        updated_at=
                            CURRENT_TIMESTAMP

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


            if (!result.rows.length) {

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

                id,
                null,
                req

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
);


/* ============================================================
   32. STATISTIQUES
============================================================ */

async function statistics(req, res) {

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
                        WHERE premium=true
                           OR is_premium=true
                    )::int
                    AS premium,


                    (
                        SELECT COUNT(*)
                        FROM users
                        WHERE blocked=true
                           OR is_blocked=true
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
                        WHERE LOWER(
                            COALESCE(status,'pending')
                        )='pending'
                    )::int
                    AS paiements_en_attente,


                    (
                        SELECT COUNT(*)
                        FROM paiements
                        WHERE LOWER(
                            COALESCE(status,'')
                        )='validated'
                    )::int
                    AS paiements_valides,


                    (
                        SELECT COUNT(*)
                        FROM paiements
                        WHERE LOWER(
                            COALESCE(status,'')
                        )='refused'
                    )::int
                    AS paiements_refuses,


                    (
                        SELECT COUNT(*)
                        FROM demandes_paiement
                    )::int
                    AS demandes_paiement,


                    (
                        SELECT COUNT(*)
                        FROM demandes_paiement
                        WHERE LOWER(
                            COALESCE(status,'pending')
                        )='pending'
                    )::int
                    AS demandes_en_attente,


                    (
                        SELECT COUNT(*)
                        FROM demandes_paiement
                        WHERE LOWER(
                            COALESCE(status,'')
                        )='validated'
                    )::int
                    AS demandes_validees,


                    (
                        SELECT COUNT(*)
                        FROM demandes_paiement
                        WHERE LOWER(
                            COALESCE(status,'')
                        )='refused'
                    )::int
                    AS demandes_refusees,


                    (
                        SELECT COALESCE(
                            SUM(amount),
                            0
                        )

                        FROM paiements

                        WHERE LOWER(
                            COALESCE(status,'')
                        )='validated'
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

                paiements_en_attente:
                    Number(
                        s.paiements_en_attente
                    ),

                paiements_valides:
                    Number(
                        s.paiements_valides
                    ),

                paiements_refuses:
                    Number(
                        s.paiements_refuses
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
   33. JOURNAL ADMIN
============================================================ */

app.get(
    "/api/admin/journal",
    adminAuth,
    async function (req, res) {

        try {

            const limit =
                Math.min(

                    Number(
                        req.query.limit
                    ) || 100,

                    500

                );


            const result =
                await pool.query(

                    `
                    SELECT *

                    FROM admin_activity

                    ORDER BY
                        created_at DESC

                    LIMIT $1
                    `,

                    [limit]

                );


            return success(

                res,

                result.rows,

                "Journal administrateur chargé"

            );

        } catch (err) {

            return error(
                res,
                "Impossible de charger le journal.",
                500,
                err.message
            );

        }

    }
);


/* ============================================================
   34. MESSAGERIE
============================================================ */


/*
   ENVOYER UN MESSAGE À UN UTILISATEUR
*/

async function sendMessageToUser(req, res) {

    try {

        const userId =
            parseId(
                req.body?.user_id ??
                req.body?.userId
            );


        const subject =
            String(
                req.body?.subject ||
                req.body?.sujet ||
                ""
            ).trim();


        const content =
            String(
                req.body?.content ||
                req.body?.message ||
                ""
            ).trim();


        if (!userId) {

            return error(
                res,
                "ID utilisateur invalide.",
                400
            );

        }


        if (!content) {

            return error(
                res,
                "Le message est obligatoire.",
                400
            );

        }


        const user =
            await pool.query(

                `
                SELECT id, nom, email
                FROM users
                WHERE id=$1
                `,

                [userId]

            );


        if (!user.rows.length) {

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
                    sender_user_id,
                    recipient_user_id,
                    recipient_type,
                    subject,
                    content,
                    type,
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
                    'user',
                    $2,
                    $3,
                    'standard',
                    'user',
                    'unread',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )

                RETURNING *
                `,

                [
                    userId,
                    subject || null,
                    content
                ]

            );


        await logActivity(

            "SEND_MESSAGE_USER",

            `Message envoyé à utilisateur ${userId}`,

            userId,
            null,
            req

        );


        return success(

            res,

            result.rows[0],

            "Message envoyé"

        );

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
    sendMessageToUser
);


app.post(
    "/api/messages/user",
    adminAuth,
    sendMessageToUser
);


/*
   MESSAGE OFFICIEL
*/

async function sendOfficialMessage(req, res) {

    try {

        const subject =
            String(
                req.body?.subject ||
                ""
            ).trim();


        const content =
            String(
                req.body?.content ||
                req.body?.message ||
                ""
            ).trim();


        if (!content) {

            return error(
                res,
                "Le message est obligatoire.",
                400
            );

        }


        const result =
            await pool.query(

                `
                INSERT INTO messages
                (
                    sender_type,
                    recipient_type,
                    subject,
                    content,
                    type,
                    audience,
                    status
                )

                VALUES
                (
                    'admin',
                    'all',
                    $1,
                    $2,
                    'official',
                    'all',
                    'unread'
                )

                RETURNING *
                `,

                [
                    subject || null,
                    content
                ]

            );


        await logActivity(

            "SEND_OFFICIAL_MESSAGE",

            "Message officiel envoyé",

            null,
            null,
            req

        );


        return success(
            res,
            result.rows[0],
            "Message officiel envoyé"
        );

    } catch (err) {

        return error(
            res,
            "Impossible d'envoyer le message officiel.",
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


/*
   MESSAGE À TOUS
*/

async function sendAllMessage(req, res) {

    try {

        const subject =
            String(
                req.body?.subject ||
                ""
            ).trim();


        const content =
            String(
                req.body?.content ||
                req.body?.message ||
                ""
            ).trim();


        if (!content) {

            return error(
                res,
                "Le message est obligatoire.",
                400
            );

        }


        const result =
            await pool.query(

                `
                INSERT INTO messages
                (
                    sender_type,
                    recipient_type,
                    subject,
                    content,
                    type,
                    audience,
                    status
                )

                VALUES
                (
                    'admin',
                    'all',
                    $1,
                    $2,
                    'standard',
                    'all',
                    'unread'
                )

                RETURNING *
                `,

                [
                    subject || null,
                    content
                ]

            );


        await logActivity(

            "SEND_ALL_MESSAGE",

            "Message envoyé à tous les utilisateurs",

            null,
            null,
            req

        );


        return success(
            res,
            result.rows[0],
            "Message envoyé à tous"
        );

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
    "/api/messages/send-all",
    adminAuth,
    sendAllMessage
);


/*
   MESSAGE STANDARD
*/

app.post(
    "/api/messages/send-standard",
    adminAuth,
    async function (req, res) {

        req.body =
            {
                ...(req.body || {}),
                type:
                    "standard"
            };

        return sendAllMessage(
            req,
            res
        );

    }
);


/*
   MESSAGE PREMIUM
*/

app.post(
    "/api/messages/send-premium",
    adminAuth,
    async function (req, res) {

        try {

            const subject =
                String(
                    req.body?.subject ||
                    ""
                ).trim();


            const content =
                String(
                    req.body?.content ||
                    req.body?.message ||
                    ""
                ).trim();


            if (!content) {

                return error(
                    res,
                    "Le message est obligatoire.",
                    400
                );

            }


            const result =
                await pool.query(

                    `
                    INSERT INTO messages
                    (
                        sender_type,
                        recipient_type,
                        subject,
                        content,
                        type,
                        audience,
                        status
                    )

                    VALUES
                    (
                        'admin',
                        'premium',
                        $1,
                        $2,
                        'premium',
                        'premium',
                        'unread'
                    )

                    RETURNING *
                    `,

                    [
                        subject || null,
                        content
                    ]

                );


            await logActivity(

                "SEND_PREMIUM_MESSAGE",

                "Message Premium envoyé",

                null,
                null,
                req

            );


            return success(
                res,
                result.rows[0],
                "Message Premium envoyé"
            );

        } catch (err) {

            return error(
                res,
                "Impossible d'envoyer le message Premium.",
                500,
                err.message
            );

        }

    }
);


/*
   LISTE MESSAGES ADMIN
*/

app.get(
    "/api/messages",
    adminAuth,
    async function (req, res) {

        try {

            const result =
                await pool.query(

                    `
                    SELECT

                        m.*,

                        u.nom AS user_nom,

                        u.email AS user_email

                    FROM messages m

                    LEFT JOIN users u
                        ON u.id=m.recipient_user_id

                    ORDER BY
                        m.created_at DESC

                    LIMIT 500
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


/*
   RÉPONSES UTILISATEURS
*/

app.get(
    "/api/messages/reponses",
    adminAuth,
    async function (req, res) {

        try {

            const result =
                await pool.query(

                    `
                    SELECT

                        m.*,

                        u.nom AS user_nom,

                        u.email AS user_email

                    FROM messages m

                    LEFT JOIN users u
                        ON u.id=m.sender_user_id

                    WHERE m.sender_type='user'

                    ORDER BY
                        m.created_at DESC

                    LIMIT 500
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


/*
   MESSAGES D'UN UTILISATEUR
*/

app.get(
    "/api/utilisateurs/:id/messages",
    async function (req, res) {

        try {

            const userId =
                parseId(
                    req.params.id
                );


            if (!userId) {

                return error(
                    res,
                    "ID utilisateur invalide.",
                    400
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

                        sender_user_id=$1

                        OR

                        recipient_type='all'

                        OR

                        recipient_type='premium'

                    ORDER BY
                        created_at ASC
                    `,

                    [userId]

                );


            return success(
                res,
                result.rows,
                "Messages utilisateur chargés"
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


/*
   IMPORTANT :
   STREAM AVANT /:messageId
   pour éviter que "stream" soit interprété
   comme un ID de message.
*/

app.get(
    "/api/utilisateurs/:userId/messages/stream",
    async function (req, res) {

        const userId =
            parseId(
                req.params.userId
            );


        if (!userId) {

            return res.status(400).end();

        }


        res.setHeader(
            "Content-Type",
            "text/event-stream"
        );

        res.setHeader(
            "Cache-Control",
            "no-cache"
        );

        res.setHeader(
            "Connection",
            "keep-alive"
        );


        res.flushHeaders();


        res.write(
            `event: connected\n`
        );

        res.write(
            `data: ${JSON.stringify({
                success: true,
                message: "Connexion SSE active"
            })}\n\n`
        );


        const timer =
            setInterval(
                function () {

                    try {

                        res.write(
                            `event: ping\n`
                        );

                        res.write(
                            `data: ${JSON.stringify({
                                timestamp:
                                    new Date().toISOString()
                            })}\n\n`
                        );

                    } catch {}

                },
                30000
            );


        req.on(
            "close",
            function () {

                clearInterval(
                    timer
                );

            }
        );

    }
);


/*
   MESSAGE PAR ID
*/

app.get(
    "/api/messages/:id",
    adminAuth,
    async function (req, res) {

        try {

            const id =
                parseId(
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
                    SELECT

                        m.*,

                        u.nom AS user_nom,

                        u.email AS user_email

                    FROM messages m

                    LEFT JOIN users u
                        ON u.id=m.recipient_user_id

                    WHERE m.id=$1
                    `,

                    [id]

                );


            if (!result.rows.length) {

                return error(
                    res,
                    "Message introuvable.",
                    404
                );

            }


            return success(
                res,
                result.rows[0],
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


/*
   MARQUER MESSAGE LU
*/

app.patch(
    "/api/messages/:id/read",
    async function (req, res) {

        try {

            const id =
                parseId(
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

                        read_at=
                            CURRENT_TIMESTAMP,

                        updated_at=
                            CURRENT_TIMESTAMP

                    WHERE id=$1

                    RETURNING *
                    `,

                    [id]

                );


            if (!result.rows.length) {

                return error(
                    res,
                    "Message introuvable.",
                    404
                );

            }


            return success(
                res,
                result.rows[0],
                "Message marqué comme lu"
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


/*
   MODIFIER MESSAGE
*/

app.patch(
    "/api/messages/:id",
    adminAuth,
    async function (req, res) {

        try {

            const id =
                parseId(
                    req.params.id
                );


            if (!id) {

                return error(
                    res,
                    "ID message invalide.",
                    400
                );

            }


            const subject =
                req.body?.subject !== undefined
                    ? String(
                        req.body.subject
                    )
                    : null;


            const content =
                req.body?.content !== undefined
                    ? String(
                        req.body.content
                    )
                    : null;


            const result =
                await pool.query(

                    `
                    UPDATE messages

                    SET

                        subject =
                            COALESCE($1, subject),

                        content =
                            COALESCE($2, content),

                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE id=$3

                    RETURNING *
                    `,

                    [
                        subject,
                        content,
                        id
                    ]

                );


            if (!result.rows.length) {

                return error(
                    res,
                    "Message introuvable.",
                    404
                );

            }


            return success(
                res,
                result.rows[0],
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


/*
   SUPPRIMER MESSAGE
*/

app.delete(
    "/api/messages/:id",
    adminAuth,
    async function (req, res) {

        try {

            const id =
                parseId(
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


            if (!result.rows.length) {

                return error(
                    res,
                    "Message introuvable.",
                    404
                );

            }


            await logActivity(

                "DELETE_MESSAGE",

                `Message ${id} supprimé`,

                null,
                null,
                req

            );


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
   35. DASHBOARD ADMIN
============================================================ */

app.get(
    "/api/admin/dashboard",
    adminAuth,
    async function (req, res) {

        try {

            const stats =
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
                            WHERE premium=true
                               OR is_premium=true
                        )::int
                        AS premium,


                        (
                            SELECT COUNT(*)
                            FROM demandes_paiement
                            WHERE LOWER(
                                COALESCE(status,'pending')
                            )='pending'
                        )::int
                        AS demandes_en_attente,


                        (
                            SELECT COUNT(*)
                            FROM demandes_paiement
                            WHERE LOWER(
                                COALESCE(status,'')
                            )='validated'
                        )::int
                        AS demandes_validees,


                        (
                            SELECT COUNT(*)
                            FROM demandes_paiement
                            WHERE LOWER(
                                COALESCE(status,'')
                            )='refused'
                        )::int
                        AS demandes_refusees,


                        (
                            SELECT COUNT(*)
                            FROM messages
                        )::int
                        AS messages

                    `

                );


            const recent =
                await pool.query(

                    `
                    SELECT

                        d.*,

                        u.nom AS user_nom,

                        u.email AS user_email

                    FROM demandes_paiement d

                    LEFT JOIN users u
                        ON u.id=d.user_id

                    ORDER BY
                        d.created_at DESC

                    LIMIT 10
                    `

                );


            return success(

                res,

                {

                    statistiques:
                        stats.rows[0],

                    demandes_recentes:
                        recent.rows

                },

                "Dashboard administrateur chargé"

            );

        } catch (err) {

            return error(
                res,
                "Impossible de charger le dashboard.",
                500,
                err.message
            );

        }

    }
);


/* ============================================================
   36. LISTE ROUTES
============================================================ */

const ROUTES = [

    "GET /api",

    "GET /api/health",

    "POST /api/admin/login",

    "GET /api/utilisateurs",

    "GET /api/utilisateurs/:id",

    "POST /api/utilisateurs",

    "PUT /api/utilisateurs/:id",

    "PATCH /api/utilisateurs/:id",

    "DELETE /api/utilisateurs/:id",

    "GET /api/admin/utilisateurs",

    "GET /api/admin/users",

    "GET /api/paiements",

    "POST /api/paiements",

    "GET /api/paiements/:id",

    "PATCH /api/paiements/:id/valider",

    "PATCH /api/paiements/:id/refuser",

    "POST /api/demandes-paiement",

    "GET /api/demandes-paiement",

    "GET /api/demandes-paiement/:id",

    "GET /api/admin/demandes-paiement",

    "PATCH /api/admin/demandes-paiement/:id/valider",

    "PATCH /api/admin/demandes-paiement/:id/refuser",

    "PATCH /api/admin/users/:id/premium",

    "PATCH /api/admin/users/:id/block",

    "GET /api/statistiques",

    "GET /api/admin/statistiques",

    "GET /api/admin/journal",

    "GET /api/messages",

    "POST /api/messages/send-user",

    "POST /api/messages/send-official",

    "POST /api/messages/send-all",

    "POST /api/messages/send-standard",

    "POST /api/messages/send-premium",

    "GET /api/utilisateurs/:id/messages",

    "GET /api/utilisateurs/:userId/messages/stream",

    "PATCH /api/messages/:id/read",

    "DELETE /api/messages/:id",

    "GET /api/admin/dashboard"

];


/* ============================================================
   37. ROUTE POUR VOIR LES ROUTES
============================================================ */

app.get(
    "/api/routes",
    function (req, res) {

        return success(

            res,

            ROUTES,

            "Routes BMJ SERVICE"

        );

    }
);


/* ============================================================
   38. 404
============================================================ */

app.use(
    function (req, res) {

        return res.status(404).json({

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
   39. GESTIONNAIRE D'ERREURS
============================================================ */

app.use(
    function (
        err,
        req,
        res,
        next
    ) {

        console.error(
            "❌ Erreur serveur :",
            err
        );


        if (
            res.headersSent
        ) {

            return next(err);

        }


        return res.status(500).json({

            success: false,

            message:
                "Erreur interne du serveur.",

            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : err.message

        });

    }
);


/* ============================================================
   40. GRACEFUL SHUTDOWN
============================================================ */

let server = null;

let shuttingDown =
    false;


async function gracefulShutdown(
    signal
) {

    if (shuttingDown) {

        return;

    }


    shuttingDown =
        true;


    console.log(
        `\n⚠️ Signal ${signal} reçu.`
    );


    console.log(
        "→ Fermeture du serveur HTTP..."
    );


    try {

        if (server) {

            await new Promise(
                function (resolve) {

                    server.close(
                        function () {

                            resolve();

                        }
                    );

                }
            );

        }

    } catch (err) {

        console.warn(
            "Erreur fermeture HTTP :",
            err.message
        );

    }


    console.log(
        "→ Fermeture PostgreSQL..."
    );


    try {

        await pool.end();

    } catch (err) {

        console.warn(
            "Erreur fermeture PostgreSQL :",
            err.message
        );

    }


    console.log(
        "✓ BMJ SERVICE arrêté proprement."
    );


    process.exit(0);

}


process.on(
    "SIGTERM",
    function () {

        gracefulShutdown(
            "SIGTERM"
        );

    }
);


process.on(
    "SIGINT",
    function () {

        gracefulShutdown(
            "SIGINT"
        );

    }
);


/* ============================================================
   41. ERREURS PROCESS
============================================================ */

process.on(
    "unhandledRejection",
    function (reason) {

        console.error(
            "❌ Unhandled Rejection :",
            reason
        );

    }
);


process.on(
    "uncaughtException",
    function (err) {

        console.error(
            "❌ Uncaught Exception :",
            err
        );


        gracefulShutdown(
            "uncaughtException"
        );

    }
);


/* ============================================================
   42. DÉMARRAGE SERVEUR
============================================================ */

async function startServer() {

    try {

        /*
           IMPORTANT :
           La base est initialisée AVANT app.listen().
        */

        await initDatabase();


        server =
            app.listen(

                PORT,

                "0.0.0.0",

                function () {

                    console.log("");

                    console.log(
                        "=================================================="
                    );

                    console.log(
                        "             BMJ SERVICE BACKEND"
                    );

                    console.log(
                        "             VERSION 14.0.0"
                    );

                    console.log(
                        "=================================================="
                    );

                    console.log(
                        `✓ PORT : ${PORT}`
                    );

                    console.log(
                        "✓ SERVER : Render"
                    );

                    console.log(
                        "✓ DATABASE : PostgreSQL"
                    );

                    console.log(
                        "✓ API : ONLINE"
                    );

                    console.log(
                        "✓ UTILISATEURS : ACTIVÉS"
                    );

                    console.log(
                        "✓ PAIEMENTS : ACTIVÉS"
                    );

                    console.log(
                        "✓ DEMANDES PAIEMENT : ACTIVÉES"
                    );

                    console.log(
                        "✓ PREMIUM : ACTIVÉ"
                    );

                    console.log(
                        "✓ STATISTIQUES : ACTIVÉES"
                    );

                    console.log(
                        "✓ JOURNAL ADMIN : ACTIVÉ"
                    );

                    console.log(
                        "✓ MESSAGERIE : ACTIVÉE"
                    );

                    console.log(
                        "✓ HEALTH CHECK : ACTIVÉ"
                    );

                    console.log(
                        "✓ GRACEFUL SHUTDOWN : ACTIVÉ"
                    );

                    console.log(
                        "=================================================="
                    );

                    console.log(
                        `ADMIN : ${ADMIN_EMAIL}`
                    );

                    console.log(
                        `PREMIUM : ${PREMIUM_DAYS} jours`
                    );

                    console.log(
                        "=================================================="
                    );

                    console.log(
                        "NOUVELLE DEMANDE DE PAIEMENT :"
                    );

                    console.log(
                        "POST /api/demandes-paiement"
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

        process.exit(1);

    }

}


startServer();