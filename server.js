/* ============================================================
   BMJ SERVICE
   BACKEND API COMPLET
   NODE.JS + EXPRESS + POSTGRESQL
   RENDER

   VERSION : 13.0.0

   IMPORTANT :
   - NE SUPPRIME PAS LES DONNÉES EXISTANTES
   - NE SUPPRIME PAS LES TABLES EXISTANTES
   - COMPATIBLE AVEC LES ANCIENNES ROUTES
   - AJOUT DE /api/demandes-verification
============================================================ */


/* ============================================================
   1. IMPORTATIONS
============================================================ */

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const crypto = require("crypto");


/* ============================================================
   2. APPLICATION
============================================================ */

const app = express();

const PORT =
    process.env.PORT || 10000;


/* ============================================================
   3. POSTGRESQL
============================================================ */

/*
   IMPORTANT :
   En production Render, il est préférable de mettre
   DATABASE_URL dans les variables d'environnement.

   La valeur ci-dessous garde une compatibilité avec
   ta configuration actuelle.
*/

const DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://bmj_db_user:5FSX8YeJNzwinKdFOrIeEC43aQsuzf91@dpg-d9sdlt49v7es73emrq8g-a/bmj_db";


const pool =
    new Pool({

        connectionString:
            DATABASE_URL,

        ssl: {
            rejectUnauthorized: false
        },

        max: 10,

        idleTimeoutMillis:
            30000,

        connectionTimeoutMillis:
            10000

    });


/* ============================================================
   4. ADMINISTRATEUR
============================================================ */

const ADMIN_EMAIL =
    process.env.ADMIN_EMAIL ||
    "admin@bmjservice.com";


const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD ||
    "BMJAdmin@2026";


const ADMIN_SECRET =
    process.env.ADMIN_SECRET ||
    "BMJ_SERVICE_ADMIN_SECRET_2026_CHANGE_ME_9X7K2P";


/* ============================================================
   5. CORS
============================================================ */

app.use(

    cors({

        origin: true,

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
        ],

        credentials: false

    })

);


/* ============================================================
   6. BODY PARSER
============================================================ */

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
   7. LOG
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
   8. RÉPONSES STANDARD
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

    message = "Une erreur est survenue",

    status = 500,

    details = null

) {

    console.error(
        `[BMJ ERROR] ${message}`,
        details || ""
    );

    return res.status(status).json({

        success: false,

        message,

        error: message,

        details

    });

}


/* ============================================================
   9. OUTILS
============================================================ */

function parseId(value) {

    const id =
        Number(value);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {

        return null;

    }

    return id;

}


function normalizeEmail(email) {

    return String(email || "")
        .trim()
        .toLowerCase();

}


function generatePaymentReference() {

    const now =
        new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            now.getDate()
        ).padStart(2, "0");

    const random =
        crypto
            .randomBytes(5)
            .toString("hex")
            .toUpperCase();

    return (
        "BMJ-PAY-" +
        year +
        month +
        day +
        "-" +
        random
    );

}


function getBoolean(

    value,

    defaultValue = false

) {

    if (
        value === undefined ||
        value === null
    ) {

        return defaultValue;

    }

    if (
        typeof value === "boolean"
    ) {

        return value;

    }

    return (
        String(value)
            .toLowerCase() === "true"
    );

}


/* ============================================================
   10. TOKEN ADMIN
============================================================ */

function generateToken() {

    const timestamp =
        Date.now().toString();

    const random =
        crypto
            .randomBytes(32)
            .toString("hex");

    const payload =
        timestamp + "." + random;

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
            payload +
            "." +
            signature
        )
        .toString("base64url");

}


function verifyToken(token) {

    try {

        if (!token) {

            return false;

        }

        const decoded =
            Buffer
                .from(
                    token,
                    "base64url"
                )
                .toString("utf8");

        const parts =
            decoded.split(".");

        if (
            parts.length !== 3
        ) {

            return false;

        }

        const timestamp =
            parts[0];

        const random =
            parts[1];

        const signature =
            parts[2];

        const payload =
            timestamp +
            "." +
            random;

        const expected =
            crypto
                .createHmac(
                    "sha256",
                    ADMIN_SECRET
                )
                .update(payload)
                .digest("hex");

        if (
            signature.length !==
            expected.length
        ) {

            return false;

        }

        const validSignature =
            crypto.timingSafeEqual(

                Buffer.from(
                    signature
                ),

                Buffer.from(
                    expected
                )

            );

        if (!validSignature) {

            return false;

        }

        const tokenTime =
            Number(timestamp);

        if (
            !Number.isFinite(
                tokenTime
            )
        ) {

            return false;

        }

        const maxAge =
            24 *
            60 *
            60 *
            1000;

        if (
            Date.now() -
            tokenTime >
            maxAge
        ) {

            return false;

        }

        return true;

    } catch (err) {

        return false;

    }

}


/* ============================================================
   11. AUTH ADMIN
============================================================ */

function adminAuth(
    req,
    res,
    next
) {

    const authorization =
        req.headers.authorization ||
        "";

    let token = "";

    if (
        authorization.startsWith(
            "Bearer "
        )
    ) {

        token =
            authorization
                .substring(7)
                .trim();

    }

    if (
        !token &&
        req.query.token
    ) {

        token =
            String(
                req.query.token
            );

    }

    if (
        !verifyToken(token)
    ) {

        return error(

            res,

            "Accès administrateur non autorisé.",

            401

        );

    }

    req.admin = {

        email:
            ADMIN_EMAIL,

        role:
            "administrator"

    };

    next();

}


/* ============================================================
   12. JOURNAL ADMIN
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
                admin_email
            )
            VALUES
            ($1,$2,$3,$4,$5)
            `,

            [
                action,
                description,
                userId,
                paymentId,
                ADMIN_EMAIL
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
   13. INITIALISATION BASE DE DONNÉES
============================================================ */

async function initDatabase() {

    const client =
        await pool.connect();

    try {

        console.log(
            "Connexion à PostgreSQL..."
        );


        /* ====================================================
           USERS
        ==================================================== */

        await client.query(`

            CREATE TABLE IF NOT EXISTS users (

                id SERIAL PRIMARY KEY,

                nom VARCHAR(255),

                email VARCHAR(255) UNIQUE,

                telephone VARCHAR(100),

                domaine VARCHAR(255),

                password TEXT,

                photo TEXT,

                premium BOOLEAN DEFAULT FALSE,

                is_premium BOOLEAN DEFAULT FALSE,

                premium_until TIMESTAMP NULL,

                blocked BOOLEAN DEFAULT FALSE,

                is_blocked BOOLEAN DEFAULT FALSE,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP

            );

        `);


        /* ====================================================
           PAIEMENTS
        ==================================================== */

        await client.query(`

            CREATE TABLE IF NOT EXISTS paiements (

                id SERIAL PRIMARY KEY,

                user_id INTEGER NULL,

                nom VARCHAR(255),

                email VARCHAR(255),

                telephone VARCHAR(100),

                amount NUMERIC(15,2)
                    DEFAULT 0,

                montant NUMERIC(15,2)
                    DEFAULT 0,

                currency VARCHAR(20)
                    DEFAULT 'USD',

                methode VARCHAR(100),

                method VARCHAR(100),

                reference VARCHAR(255),

                transaction_id VARCHAR(255),

                preuve TEXT,

                proof TEXT,

                status VARCHAR(50)
                    DEFAULT 'pending',

                premium_days INTEGER
                    DEFAULT 30,

                notes TEXT,

                refusal_reason TEXT,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP,

                validated_at TIMESTAMP NULL,

                refused_at TIMESTAMP NULL,

                updated_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP

            );

        `);


        /* ====================================================
           ADMIN ACTIVITY
        ==================================================== */

        await client.query(`

            CREATE TABLE IF NOT EXISTS admin_activity (

                id SERIAL PRIMARY KEY,

                action VARCHAR(255),

                description TEXT,

                user_id INTEGER NULL,

                payment_id INTEGER NULL,

                admin_email VARCHAR(255),

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP

            );

        `);


        /* ====================================================
           MIGRATIONS USERS
        ==================================================== */

        await client.query(`

            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS nom VARCHAR(255);

        `);

        await client.query(`

            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS email VARCHAR(255);

        `);

        await client.query(`

            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS telephone VARCHAR(100);

        `);

        await client.query(`

            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS domaine VARCHAR(255);

        `);

        await client.query(`

            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS password TEXT;

        `);

        await client.query(`

            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS photo TEXT;

        `);

        await client.query(`

            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS premium
            BOOLEAN DEFAULT FALSE;

        `);

        await client.query(`

            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS is_premium
            BOOLEAN DEFAULT FALSE;

        `);

        await client.query(`

            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS premium_until
            TIMESTAMP NULL;

        `);

        await client.query(`

            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS blocked
            BOOLEAN DEFAULT FALSE;

        `);

        await client.query(`

            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS is_blocked
            BOOLEAN DEFAULT FALSE;

        `);

        await client.query(`

            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS created_at
            TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

        `);

        await client.query(`

            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS updated_at
            TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

        `);


        /* ====================================================
           MIGRATIONS PAIEMENTS
        ==================================================== */

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS user_id
            INTEGER NULL;

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS nom
            VARCHAR(255);

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS email
            VARCHAR(255);

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS telephone
            VARCHAR(100);

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS amount
            NUMERIC(15,2)
            DEFAULT 0;

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS montant
            NUMERIC(15,2)
            DEFAULT 0;

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS currency
            VARCHAR(20)
            DEFAULT 'USD';

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS methode
            VARCHAR(100);

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS method
            VARCHAR(100);

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS reference
            VARCHAR(255);

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS transaction_id
            VARCHAR(255);

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS preuve
            TEXT;

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS proof
            TEXT;

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS status
            VARCHAR(50)
            DEFAULT 'pending';

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS premium_days
            INTEGER
            DEFAULT 30;

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS notes
            TEXT;

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS refusal_reason
            TEXT;

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS created_at
            TIMESTAMP
            DEFAULT CURRENT_TIMESTAMP;

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS validated_at
            TIMESTAMP NULL;

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS refused_at
            TIMESTAMP NULL;

        `);

        await client.query(`

            ALTER TABLE paiements
            ADD COLUMN IF NOT EXISTS updated_at
            TIMESTAMP
            DEFAULT CURRENT_TIMESTAMP;

        `);


        /* ====================================================
           INDEX
        ==================================================== */

        await client.query(`

            CREATE INDEX IF NOT EXISTS
            idx_users_email
            ON users(email);

        `);

        await client.query(`

            CREATE INDEX IF NOT EXISTS
            idx_users_premium
            ON users(premium);

        `);

        await client.query(`

            CREATE INDEX IF NOT EXISTS
            idx_users_blocked
            ON users(blocked);

        `);

        await client.query(`

            CREATE INDEX IF NOT EXISTS
            idx_paiements_status
            ON paiements(status);

        `);

        await client.query(`

            CREATE INDEX IF NOT EXISTS
            idx_paiements_user
            ON paiements(user_id);

        `);

        await client.query(`

            CREATE INDEX IF NOT EXISTS
            idx_paiements_created
            ON paiements(created_at);

        `);

        await client.query(`

            CREATE INDEX IF NOT EXISTS
            idx_paiements_reference
            ON paiements(reference);

        `);


        console.log(
            "Base PostgreSQL prête."
        );

    } catch (err) {

        console.error(
            "Erreur initialisation PostgreSQL :",
            err
        );

        throw err;

    } finally {

        client.release();

    }

}


/* ============================================================
   14. ROUTE /
============================================================ */

app.get(
    "/",
    function(req, res) {

        res.json({

            success: true,

            service:
                "BMJ SERVICE BACKEND",

            version:
                "13.0.0",

            status:
                "online",

            database:
                "PostgreSQL",

            server:
                "Render",

            time:
                new Date().toISOString()

        });

    }
);


/* ============================================================
   15. ROUTE /api
============================================================ */

app.get(
    "/api",
    function(req, res) {

        success(

            res,

            {

                version:
                    "13.0.0",

                status:
                    "online",

                service:
                    "BMJ SERVICE API"

            },

            "API BMJ SERVICE opérationnelle"

        );

    }
);


/* ============================================================
   16. HEALTH
============================================================ */

app.get(
    "/api/health",
    async function(req, res) {

        try {

            const result =
                await pool.query(
                    "SELECT NOW() AS database_time"
                );

            success(

                res,

                {

                    server:
                        "online",

                    database:
                        "connected",

                    database_time:
                        result.rows[0]
                            .database_time,

                    time:
                        new Date()
                            .toISOString()

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


/* ============================================================
   17. TEST DATABASE
============================================================ */

app.get(
    "/api/test-db",
    async function(req, res) {

        try {

            const result =
                await pool.query(
                    "SELECT NOW() AS date"
                );

            success(

                res,

                result.rows[0],

                "Connexion PostgreSQL réussie"

            );

        } catch (err) {

            error(

                res,

                "Connexion PostgreSQL échouée.",

                500,

                err.message

            );

        }

    }
);


/* ============================================================
   18. NOUVELLE ROUTE
       DEMANDE DE VÉRIFICATION DE PAIEMENT
============================================================ */

/*
   Cette route est celle utilisée par :

   POST
   /api/demandes-verification

   Elle enregistre directement la demande
   dans la table paiements.

   IMPORTANT :
   Aucune donnée existante n'est supprimée.
*/

app.post(

    "/api/demandes-verification",

    async function(req, res) {

        const client =
            await pool.connect();

        try {

            const {

                numero_payeur,

                user_id,

                nom,

                email,

                telephone,

                domaine,

                formule,

                montant,

                devise,

                moyen_paiement,

                methode,

                operateur,

                reference,

                transaction_id

            } = req.body || {};


            /* =================================================
               VALIDATION NUMÉRO
            ================================================= */

            const phone =
                String(
                    numero_payeur ||
                    telephone ||
                    ""
                ).trim();


            if (!phone) {

                return error(

                    res,

                    "Le numéro ayant effectué le paiement est obligatoire.",

                    400

                );

            }


            const cleanPhone =
                phone.replace(
                    /[^0-9]/g,
                    ""
                );


            if (
                cleanPhone.length < 8
            ) {

                return error(

                    res,

                    "Le numéro de paiement est invalide.",

                    400

                );

            }


            /* =================================================
               UTILISATEUR
            ================================================= */

            const parsedUserId =
                parseId(user_id);


            const userName =
                String(
                    nom || ""
                ).trim();


            const userEmail =
                normalizeEmail(
                    email
                );


            /* =================================================
               MONTANT
            ================================================= */

            let amount =
                Number(
                    montant
                );


            if (
                !Number.isFinite(
                    amount
                )
            ) {

                amount = 0;

            }


            if (
                amount < 0
            ) {

                amount = 0;

            }


            /* =================================================
               REFERENCE
            ================================================= */

            let paymentReference =
                String(
                    reference || ""
                ).trim();


            if (
                !paymentReference
            ) {

                paymentReference =
                    generatePaymentReference();

            }


            /* =================================================
               DONNÉES
            ================================================= */

            const paymentMethod =
                String(
                    moyen_paiement ||
                    methode ||
                    "Mobile Money"
                ).trim();


            const paymentOperator =
                String(
                    operateur ||
                    "Airtel Money"
                ).trim();


            const notes = [

                formule
                    ? `Formule: ${formule}`
                    : "",

                domaine
                    ? `Domaine: ${domaine}`
                    : "",

                paymentOperator
                    ? `Opérateur: ${paymentOperator}`
                    : "",

                "Demande envoyée depuis la page de paiement BMJ SERVICE."

            ]

                .filter(Boolean)

                .join(" | ");


            /* =================================================
               TRANSACTION
            ================================================= */

            await client.query(
                "BEGIN"
            );


            /*
               Vérification d'une éventuelle demande
               déjà créée avec la même référence.

               Cela évite les doublons si l'utilisateur
               clique deux fois.
            */

            const existing =
                await client.query(

                    `
                    SELECT
                        id,
                        reference,
                        status,
                        created_at
                    FROM paiements
                    WHERE reference = $1
                    LIMIT 1
                    `,

                    [
                        paymentReference
                    ]

                );


            if (
                existing.rows.length > 0
            ) {

                await client.query(
                    "COMMIT"
                );


                return success(

                    res,

                    existing.rows[0],

                    "Cette demande de paiement existe déjà."

                );

            }


            /* =================================================
               INSERTION
            ================================================= */

            const insertResult =
                await client.query(

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
                        $6,

                        $7,

                        $8,
                        $9,

                        $10,
                        $11,

                        'pending',

                        30,

                        $12,

                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )

                    RETURNING
                        id,
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
                        status,
                        premium_days,
                        notes,
                        created_at,
                        updated_at
                    `,

                    [

                        parsedUserId,

                        userName,

                        userEmail || null,

                        phone,

                        amount,

                        amount,

                        String(
                            devise || "USD"
                        ).toUpperCase(),

                        paymentMethod,

                        paymentMethod,

                        paymentReference,

                        transaction_id
                            ? String(
                                transaction_id
                            ).trim()
                            : null,

                        notes

                    ]

                );


            await client.query(
                "COMMIT"
            );


            const payment =
                insertResult.rows[0];


            /* =================================================
               JOURNAL ADMIN
            ================================================= */

            await logActivity(

                "PAYMENT_REQUEST",

                `Nouvelle demande de paiement ${payment.reference}`,

                payment.user_id,

                payment.id

            );


            /* =================================================
               RÉPONSE
            ================================================= */

            return success(

                res,

                {

                    ...payment,

                    formule:
                        formule || null,

                    domaine:
                        domaine || null,

                    operateur:
                        paymentOperator,

                    numero_payeur:
                        phone

                },

                "Demande de paiement enregistrée avec succès."

            );


        } catch (err) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (
                rollbackError
            ) {

                console.error(
                    "Erreur rollback :",
                    rollbackError.message
                );

            }


            console.error(
                "Erreur /api/demandes-verification :",
                err
            );


            return error(

                res,

                "Impossible d'enregistrer la demande de paiement.",

                500,

                err.message

            );

        } finally {

            client.release();

        }

    }

);


/* ============================================================
   19. GET DEMANDES DE PAIEMENT
============================================================ */

app.get(

    "/api/paiements",

    async function(req, res) {

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
                        ON u.id = p.user_id

                    ORDER BY
                        p.created_at DESC
                    `

                );


            return success(

                res,

                result.rows,

                "Liste des paiements récupérée."

            );

        } catch (err) {

            return error(

                res,

                "Impossible de récupérer les paiements.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   20. GET UN PAIEMENT
============================================================ */

app.get(

    "/api/paiements/:id",

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
                    SELECT
                        p.*,

                        u.nom AS user_nom_db,
                        u.email AS user_email_db,
                        u.telephone AS user_telephone_db

                    FROM paiements p

                    LEFT JOIN users u
                        ON u.id = p.user_id

                    WHERE p.id = $1
                    LIMIT 1
                    `,

                    [id]

                );


            if (
                result.rows.length === 0
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

                "Paiement trouvé."

            );

        } catch (err) {

            return error(

                res,

                "Erreur récupération paiement.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   21. VALIDATION PAIEMENT
============================================================ */

app.patch(

    "/api/paiements/:id/valider",

    async function(req, res) {

        const client =
            await pool.connect();

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

                return error(

                    res,

                    "Paiement introuvable.",

                    404

                );

            }


            const payment =
                paymentResult.rows[0];


            if (
                payment.status === "validated" ||
                payment.status === "approved"
            ) {

                await client.query(
                    "COMMIT"
                );

                return success(

                    res,

                    payment,

                    "Ce paiement est déjà validé."

                );

            }


            const premiumDays =
                Number(
                    payment.premium_days
                ) > 0
                    ? Number(
                        payment.premium_days
                    )
                    : 30;


            await client.query(

                `
                UPDATE paiements

                SET
                    status = 'validated',
                    validated_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = $1
                `,

                [id]

            );


            if (
                payment.user_id
            ) {

                await client.query(

                    `
                    UPDATE users

                    SET
                        premium = TRUE,
                        is_premium = TRUE,

                        premium_until =
                            CASE

                                WHEN premium_until IS NOT NULL
                                AND premium_until > CURRENT_TIMESTAMP

                                THEN premium_until
                                    + ($2 || ' days')::interval

                                ELSE CURRENT_TIMESTAMP
                                    + ($2 || ' days')::interval

                            END,

                        updated_at = CURRENT_TIMESTAMP

                    WHERE id = $1
                    `,

                    [
                        payment.user_id,
                        premiumDays
                    ]

                );

            }


            await client.query(
                "COMMIT"
            );


            await logActivity(

                "PAYMENT_VALIDATED",

                `Paiement ${payment.reference} validé.`,

                payment.user_id,

                payment.id

            );


            return success(

                res,

                {

                    payment_id:
                        payment.id,

                    reference:
                        payment.reference,

                    user_id:
                        payment.user_id,

                    status:
                        "validated",

                    premium_days:
                        premiumDays

                },

                "Paiement validé et Premium activé."

            );


        } catch (err) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (rollbackError) {

                console.error(
                    rollbackError.message
                );

            }

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

);


/* ============================================================
   22. REFUS PAIEMENT
============================================================ */

app.patch(

    "/api/paiements/:id/refuser",

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


            const reason =
                String(
                    req.body?.reason ||
                    req.body?.refusal_reason ||
                    "Paiement non confirmé."
                ).trim();


            const result =
                await pool.query(

                    `
                    UPDATE paiements

                    SET
                        status = 'refused',
                        refusal_reason = $2,
                        refused_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE id = $1

                    RETURNING *
                    `,

                    [
                        id,
                        reason
                    ]

                );


            if (
                result.rows.length === 0
            ) {

                return error(

                    res,

                    "Paiement introuvable.",

                    404

                );

            }


            const payment =
                result.rows[0];


            await logActivity(

                "PAYMENT_REFUSED",

                `Paiement ${payment.reference} refusé.`,

                payment.user_id,

                payment.id

            );


            return success(

                res,

                payment,

                "Paiement refusé."

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

);


/* ============================================================
   23. CONNEXION ADMIN
============================================================ */

app.post(

    "/api/admin/connexion",

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


        if (
            email !==
            normalizeEmail(
                ADMIN_EMAIL
            ) ||
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
            generateToken();


        return success(

            res,

            {

                token,

                admin: {

                    email:
                        ADMIN_EMAIL,

                    role:
                        "administrator"

                }

            },

            "Connexion administrateur réussie."

        );

    }

);


/* ============================================================
   24. ALIAS LOGIN ADMIN
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


        if (
            email !==
            normalizeEmail(
                ADMIN_EMAIL
            ) ||
            password !==
            ADMIN_PASSWORD
        ) {

            return error(

                res,

                "Identifiants administrateur incorrects.",

                401

            );

        }


        return success(

            res,

            {

                token:
                    generateToken(),

                admin: {

                    email:
                        ADMIN_EMAIL,

                    role:
                        "administrator"

                }

            },

            "Connexion administrateur réussie."

        );

    }

);


/* ============================================================
   25. ADMIN ME
============================================================ */

app.get(

    "/api/admin/me",

    adminAuth,

    function(req, res) {

        return success(

            res,

            {

                email:
                    ADMIN_EMAIL,

                role:
                    "administrator"

            },

            "Administrateur authentifié."

        );

    }

);


/* ============================================================
   26. ADMIN PAIEMENTS
============================================================ */

app.get(

    "/api/admin/paiements",

    adminAuth,

    async function(req, res) {

        try {

            const result =
                await pool.query(

                    `
                    SELECT
                        p.*,

                        u.nom AS user_nom_db,
                        u.email AS user_email_db,
                        u.telephone AS user_telephone_db,
                        u.domaine AS user_domaine_db

                    FROM paiements p

                    LEFT JOIN users u
                        ON u.id = p.user_id

                    ORDER BY
                        p.created_at DESC
                    `

                );


            return success(

                res,

                result.rows,

                "Paiements administrateur récupérés."

            );

        } catch (err) {

            return error(

                res,

                "Impossible de récupérer les paiements.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   27. ALIAS ADMIN PAYMENTS
============================================================ */

app.get(

    "/api/admin/payments",

    adminAuth,

    async function(req, res) {

        try {

            const result =
                await pool.query(

                    `
                    SELECT
                        p.*,

                        u.nom AS user_nom_db,
                        u.email AS user_email_db,
                        u.telephone AS user_telephone_db,
                        u.domaine AS user_domaine_db

                    FROM paiements p

                    LEFT JOIN users u
                        ON u.id = p.user_id

                    ORDER BY
                        p.created_at DESC
                    `

                );


            return success(

                res,

                result.rows,

                "Paiements récupérés."

            );

        } catch (err) {

            return error(

                res,

                "Erreur récupération paiements.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   28. ADMIN VALIDATION ALIAS
============================================================ */

app.patch(

    "/api/admin/paiements/:id/valider",

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

                    "ID invalide.",

                    400

                );

            }


            const result =
                await pool.query(

                    `
                    SELECT *
                    FROM paiements
                    WHERE id = $1
                    `,

                    [id]

                );


            if (
                result.rows.length === 0
            ) {

                return error(

                    res,

                    "Paiement introuvable.",

                    404

                );

            }


            const payment =
                result.rows[0];


            await pool.query(

                `
                UPDATE paiements

                SET
                    status = 'validated',
                    validated_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = $1
                `,

                [id]

            );


            if (
                payment.user_id
            ) {

                await pool.query(

                    `
                    UPDATE users

                    SET
                        premium = TRUE,
                        is_premium = TRUE,

                        premium_until =
                            CASE

                                WHEN premium_until IS NOT NULL
                                AND premium_until > CURRENT_TIMESTAMP

                                THEN premium_until
                                    + ($2 || ' days')::interval

                                ELSE CURRENT_TIMESTAMP
                                    + ($2 || ' days')::interval

                            END,

                        updated_at = CURRENT_TIMESTAMP

                    WHERE id = $1
                    `,

                    [
                        payment.user_id,
                        Number(
                            payment.premium_days
                        ) > 0
                            ? Number(
                                payment.premium_days
                            )
                            : 30
                    ]

                );

            }


            await logActivity(

                "PAYMENT_VALIDATED",

                `Paiement ${payment.reference} validé par administration.`,

                payment.user_id,

                payment.id

            );


            return success(

                res,

                {

                    id:
                        payment.id,

                    reference:
                        payment.reference,

                    status:
                        "validated"

                },

                "Paiement validé."

            );

        } catch (err) {

            return error(

                res,

                "Erreur validation paiement.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   29. ROUTE INCONNUE
============================================================ */

app.use(

    function(req, res) {

        return res.status(404).json({

            success: false,

            message:
                "Route introuvable.",

            error:
                `Cannot ${req.method} ${req.originalUrl}`

        });

    }

);


/* ============================================================
   30. ERREUR GLOBALE
============================================================ */

app.use(

    function(err, req, res, next) {

        console.error(
            "Erreur serveur globale :",
            err
        );


        return res.status(500).json({

            success: false,

            message:
                "Erreur interne du serveur.",

            error:
                err.message

        });

    }

);


/* ============================================================
   31. DÉMARRAGE
============================================================ */

async function startServer() {

    try {

        await initDatabase();


        app.listen(

            PORT,

            function() {

                console.log(
                    "===================================="
                );

                console.log(
                    "BMJ SERVICE BACKEND"
                );

                console.log(
                    "Serveur démarré sur le port " +
                    PORT
                );

                console.log(
                    "PostgreSQL connecté"
                );

                console.log(
                    "API : /api"
                );

                console.log(
                    "Paiement : /api/demandes-verification"
                );

                console.log(
                    "===================================="
                );

            }

        );

    } catch (err) {

        console.error(
            "Impossible de démarrer le serveur :",
            err
        );

        process.exit(1);

    }

}


startServer();