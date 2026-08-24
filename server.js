/* ============================================================
   BMJ SERVICE
   BACKEND COMPLET
   NODE.JS + EXPRESS + POSTGRESQL
   DESTINATION : RENDER

   VERSION : 11.0.0

   ============================================================
   FONCTIONS
   ------------------------------------------------------------
   - Connexion PostgreSQL
   - CORS
   - Authentification administrateur
   - Dashboard admin
   - Utilisateurs
   - Paiements
   - Validation paiement
   - Refus paiement
   - Activation Premium
   - Désactivation Premium
   - Blocage utilisateur
   - Déblocage utilisateur
   - Paiement manuel
   - Statistiques
   ============================================================ */


/* ============================================================
   1. IMPORTATIONS
============================================================ */

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const crypto = require("crypto");


/* ============================================================
   2. CONFIGURATION
============================================================ */

const app = express();

const PORT = process.env.PORT || 10000;


/*
   IMPORTANT :

   Connexion PostgreSQL demandée.
*/

const DATABASE_URL =
    "postgresql://bmj_db_user:5FSX8YeJNzwinKdFOrIeEC43aQsuzf91@dpg-d9sdlt49v7es73emrq8g-a/bmj_db";


/*
   ADMIN

   Ces identifiants sont directement définis ici.
*/

const ADMIN_EMAIL =
    "admin@bmjservice.com";

const ADMIN_PASSWORD =
    "BMJAdmin@2026";


/*
   Clé secrète pour les sessions administrateur.
*/

const ADMIN_SECRET =
    "BMJ_SERVICE_ADMIN_SECRET_2026_CHANGE_ME_9X7K2P";


/* ============================================================
   3. POSTGRESQL
============================================================ */

const pool = new Pool({

    connectionString: DATABASE_URL,

    ssl: {
        rejectUnauthorized: false
    },

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000
});


/* ============================================================
   4. CORS
============================================================ */

app.use(
    cors({

        origin: function(origin, callback) {

            /*
               Autorise :
               - Vercel
               - Render
               - localhost
               - requêtes sans origin
            */

            callback(null, true);
        },

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


app.options(
    "*",
    cors()
);


/* ============================================================
   5. JSON
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
   6. LOG DES REQUÊTES
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
   7. OUTILS
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
        message,
        details || ""
    );

    return res.status(status).json({

        success: false,

        message,

        error: message,

        details
    });
}


function generateToken() {

    const payload =
        Date.now() +
        "." +
        crypto.randomBytes(32).toString("hex");

    const signature =
        crypto
            .createHmac(
                "sha256",
                ADMIN_SECRET
            )
            .update(payload)
            .digest("hex");

    return Buffer
        .from(payload + "." + signature)
        .toString("base64url");
}


function verifyToken(token) {

    try {

        if (!token) {
            return false;
        }

        const decoded =
            Buffer
                .from(token, "base64url")
                .toString("utf8");

        const parts =
            decoded.split(".");

        if (parts.length < 3) {
            return false;
        }

        const signature =
            parts.pop();

        const payload =
            parts.join(".");

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

    } catch (e) {

        return false;
    }
}


/* ============================================================
   8. AUTH ADMIN
============================================================ */

function adminAuth(req, res, next) {

    const authorization =
        req.headers.authorization || "";

    let token = "";

    if (
        authorization.startsWith(
            "Bearer "
        )
    ) {

        token =
            authorization.substring(7);
    }

    /*
       Compatibilité supplémentaire :
       ?token=
    */

    if (!token && req.query.token) {

        token =
            req.query.token;
    }

    if (!verifyToken(token)) {

        return error(
            res,
            "Accès administrateur non autorisé.",
            401
        );
    }

    req.admin = {

        email: ADMIN_EMAIL,

        role: "administrator"
    };

    next();
}


/* ============================================================
   9. INITIALISATION BASE DE DONNÉES
============================================================ */

async function initDatabase() {

    const client =
        await pool.connect();

    try {

        console.log(
            "Initialisation PostgreSQL..."
        );


        /* ====================================================
           TABLE USERS
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

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

            );

        `);


        /* ====================================================
           TABLE PAYMENTS
        ==================================================== */

        await client.query(`

            CREATE TABLE IF NOT EXISTS paiements (

                id SERIAL PRIMARY KEY,

                user_id INTEGER NULL,

                nom VARCHAR(255),

                email VARCHAR(255),

                telephone VARCHAR(100),

                amount NUMERIC(15,2) DEFAULT 0,

                montant NUMERIC(15,2) DEFAULT 0,

                currency VARCHAR(20) DEFAULT 'USD',

                methode VARCHAR(100),

                method VARCHAR(100),

                reference VARCHAR(255),

                transaction_id VARCHAR(255),

                preuve TEXT,

                proof TEXT,

                status VARCHAR(50) DEFAULT 'pending',

                premium_days INTEGER DEFAULT 30,

                notes TEXT,

                refusal_reason TEXT,

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                validated_at TIMESTAMP NULL,

                refused_at TIMESTAMP NULL,

                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

            );

        `);


        /* ====================================================
           TABLE ADMIN ACTIVITY
        ==================================================== */

        await client.query(`

            CREATE TABLE IF NOT EXISTS admin_activity (

                id SERIAL PRIMARY KEY,

                action VARCHAR(255),

                description TEXT,

                user_id INTEGER NULL,

                payment_id INTEGER NULL,

                admin_email VARCHAR(255),

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

            );

        `);


        /* ====================================================
           INDEX
        ==================================================== */

        await client.query(`

            CREATE INDEX IF NOT EXISTS idx_users_email
            ON users(email);

        `);


        await client.query(`

            CREATE INDEX IF NOT EXISTS idx_users_premium
            ON users(premium);

        `);


        await client.query(`

            CREATE INDEX IF NOT EXISTS idx_users_blocked
            ON users(blocked);

        `);


        await client.query(`

            CREATE INDEX IF NOT EXISTS idx_payments_status
            ON paiements(status);

        `);


        await client.query(`

            CREATE INDEX IF NOT EXISTS idx_payments_user
            ON paiements(user_id);

        `);


        console.log(
            "PostgreSQL initialisé avec succès."
        );

    } catch (err) {

        console.error(
            "Erreur initialisation DB :",
            err
        );

        throw err;

    } finally {

        client.release();
    }
}


/* ============================================================
   10. ACTIVITÉ ADMIN
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
            VALUES ($1,$2,$3,$4,$5)
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
            "Erreur activité :",
            err.message
        );
    }
}


/* ============================================================
   11. ROUTE RACINE
============================================================ */

app.get(
    "/",
    function(req, res) {

        res.json({

            success: true,

            service:
                "BMJ SERVICE BACKEND",

            version:
                "11.0.0",

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
   12. API
============================================================ */

app.get(
    "/api",
    function(req, res) {

        success(
            res,
            {
                version: "11.0.0",
                status: "online"
            },
            "API BMJ SERVICE opérationnelle"
        );
    }
);


/* ============================================================
   13. ROUTES
============================================================ */

app.get(
    "/api/routes",
    function(req, res) {

        success(
            res,
            {
                version: "11.0.0",

                routes: [

                    "GET /",
                    "GET /api",
                    "GET /api/routes",
                    "GET /api/health",
                    "GET /api/test-db",

                    "POST /api/inscription",
                    "POST /api/register",
                    "POST /api/signup",

                    "POST /api/connexion",
                    "POST /api/login",
                    "POST /api/signin",

                    "POST /api/admin/connexion",
                    "POST /api/admin/login",
                    "POST /api/admin/signin",
                    "POST /api/admin/logout",

                    "GET /api/admin/me",
                    "GET /api/admin/dashboard",
                    "GET /api/admin/utilisateurs",
                    "GET /api/admin/users",
                    "GET /api/admin/paiements",
                    "GET /api/admin/payments",
                    "GET /api/admin/statistiques",

                    "GET /api/utilisateurs",
                    "GET /api/utilisateurs/:id",
                    "POST /api/utilisateurs",
                    "PUT /api/utilisateurs/:id",
                    "PATCH /api/utilisateurs/:id",
                    "DELETE /api/utilisateurs/:id",

                    "GET /api/users",
                    "GET /api/users/:id",
                    "POST /api/users",

                    "GET /api/paiements",
                    "GET /api/paiements/:id",
                    "POST /api/paiements",
                    "POST /api/paiements/manual",
                    "POST /api/admin/paiements/manual",

                    "PUT /api/paiements/:id",
                    "PATCH /api/paiements/:id",
                    "DELETE /api/paiements/:id",

                    "PATCH /api/paiements/:id/valider",
                    "PATCH /api/paiements/:id/refuser",

                    "PATCH /api/admin/paiements/:id/valider",
                    "PATCH /api/admin/paiements/:id/refuser",

                    "PATCH /api/admin/users/:id/premium",
                    "PATCH /api/admin/users/:id/block",

                    "GET /api/statistiques"
                ]
            }
        );
    }
);


/* ============================================================
   14. HEALTH
============================================================ */

app.get(
    "/api/health",
    async function(req, res) {

        try {

            await pool.query(
                "SELECT NOW()"
            );

            success(
                res,
                {
                    server: "online",
                    database: "connected",
                    time: new Date().toISOString()
                },
                "Serveur opérationnel"
            );

        } catch (err) {

            error(
                res,
                "Base de données indisponible.",
                503,
                err.message
            );
        }
    }
);


/* ============================================================
   15. TEST DATABASE
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
   16. INSCRIPTION
============================================================ */

async function registerUser(req, res) {

    try {

        const {

            nom,
            email,
            telephone,
            domaine,
            password,
            motDePasse,
            photo

        } = req.body;

        const finalPassword =
            password ||
            motDePasse ||
            "";

        if (
            !nom ||
            !email ||
            !finalPassword
        ) {

            return error(
                res,
                "Nom, email et mot de passe obligatoires.",
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

                [email.trim()]
            );


        if (existing.rows.length > 0) {

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
                    is_premium
                )
                VALUES
                ($1,$2,$3,$4,$5,$6,false,false)
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
                    created_at
                `,

                [
                    nom,
                    email.trim().toLowerCase(),
                    telephone || null,
                    domaine || null,
                    finalPassword,
                    photo || null
                ]
            );


        await logActivity(
            "INSCRIPTION",
            `Nouvel utilisateur : ${email}`,
            result.rows[0].id
        );


        return success(
            res,
            result.rows[0],
            "Inscription réussie"
        );

    } catch (err) {

        return error(
            res,
            "Erreur lors de l'inscription.",
            500,
            err.message
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


/* ============================================================
   17. CONNEXION UTILISATEUR
============================================================ */

async function loginUser(req, res) {

    try {

        const email =
            (
                req.body.email ||
                ""
            )
                .trim()
                .toLowerCase();

        const password =
            req.body.password ||
            req.body.motDePasse ||
            "";


        if (!email || !password) {

            return error(
                res,
                "Email et mot de passe obligatoires.",
                400
            );
        }


        const result =
            await pool.query(

                `
                SELECT *
                FROM users
                WHERE LOWER(email)=LOWER($1)
                LIMIT 1
                `,

                [email]
            );


        if (!result.rows.length) {

            return error(
                res,
                "Email ou mot de passe incorrect.",
                401
            );
        }


        const user =
            result.rows[0];


        if (
            user.blocked ||
            user.is_blocked
        ) {

            return error(
                res,
                "Votre compte est bloqué.",
                403
            );
        }


        if (
            user.password !== password
        ) {

            return error(
                res,
                "Email ou mot de passe incorrect.",
                401
            );
        }


        return success(
            res,
            {
                user: {

                    id: user.id,
                    nom: user.nom,
                    email: user.email,
                    telephone: user.telephone,
                    domaine: user.domaine,
                    photo: user.photo,

                    premium:
                        user.premium ||
                        user.is_premium,

                    is_premium:
                        user.is_premium ||
                        user.premium,

                    premium_until:
                        user.premium_until
                }
            },
            "Connexion réussie"
        );

    } catch (err) {

        return error(
            res,
            "Erreur de connexion.",
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
   18. CONNEXION ADMIN
============================================================ */

async function adminLogin(req, res) {

    try {

        const email =
            (
                req.body.email ||
                ""
            )
                .trim()
                .toLowerCase();

        const password =
            req.body.password ||
            "";


        if (
            email !==
            ADMIN_EMAIL.toLowerCase()
        ) {

            return error(
                res,
                "Email administrateur incorrect.",
                401
            );
        }


        if (
            password !==
            ADMIN_PASSWORD
        ) {

            return error(
                res,
                "Mot de passe administrateur incorrect.",
                401
            );
        }


        const token =
            generateToken();


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
                        ADMIN_EMAIL,

                    role:
                        "administrator",

                    nom:
                        "Administrateur BMJ SERVICE"
                }

            },
            "Connexion administrateur réussie"
        );

    } catch (err) {

        return error(
            res,
            "Erreur connexion admin.",
            500,
            err.message
        );
    }
}


app.post(
    "/api/admin/connexion",
    adminLogin
);

app.post(
    "/api/admin/login",
    adminLogin
);

app.post(
    "/api/admin/signin",
    adminLogin
);


/* ============================================================
   19. ADMIN LOGOUT
============================================================ */

app.post(
    "/api/admin/logout",
    adminAuth,
    async function(req, res) {

        await logActivity(
            "ADMIN_LOGOUT",
            "Déconnexion administrateur"
        );

        success(
            res,
            null,
            "Déconnexion réussie"
        );
    }
);


/* ============================================================
   20. ADMIN ME
============================================================ */

app.get(
    "/api/admin/me",
    adminAuth,
    function(req, res) {

        success(
            res,
            {
                email: ADMIN_EMAIL,
                role: "administrator",
                nom: "Administrateur BMJ SERVICE"
            }
        );
    }
);


/* ============================================================
   21. ADMIN DASHBOARD
============================================================ */

app.get(
    "/api/admin/dashboard",
    adminAuth,
    async function(req, res) {

        try {

            const users =
                await pool.query(
                    `
                    SELECT COUNT(*)::int AS count
                    FROM users
                    `
                );


            const premium =
                await pool.query(
                    `
                    SELECT COUNT(*)::int AS count
                    FROM users
                    WHERE premium=true
                       OR is_premium=true
                    `
                );


            const pending =
                await pool.query(
                    `
                    SELECT COUNT(*)::int AS count
                    FROM paiements
                    WHERE LOWER(status) IN
                    ('pending','en_attente','attente')
                    `
                );


            const blocked =
                await pool.query(
                    `
                    SELECT COUNT(*)::int AS count
                    FROM users
                    WHERE blocked=true
                       OR is_blocked=true
                    `
                );


            const recent =
                await pool.query(
                    `
                    SELECT *
                    FROM paiements
                    ORDER BY created_at DESC
                    LIMIT 10
                    `
                );


            return success(
                res,
                {

                    utilisateurs:
                        users.rows[0].count,

                    users:
                        users.rows[0].count,

                    premium:
                        premium.rows[0].count,

                    pending:
                        pending.rows[0].count,

                    paiements_en_attente:
                        pending.rows[0].count,

                    blocked:
                        blocked.rows[0].count,

                    utilisateurs_bloques:
                        blocked.rows[0].count,

                    paiements_recents:
                        recent.rows

                }
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
   22. UTILISATEURS ADMIN
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
                ORDER BY created_at DESC
                `
            );


        success(
            res,
            result.rows
        );

    } catch (err) {

        error(
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
   23. UTILISATEURS PUBLIC
============================================================ */

app.get(
    "/api/utilisateurs",
    async function(req, res) {

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

            success(
                res,
                result.rows
            );

        } catch (err) {

            error(
                res,
                "Impossible de charger les utilisateurs.",
                500,
                err.message
            );
        }
    }
);


app.get(
    "/api/users",
    async function(req, res) {

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

            success(
                res,
                result.rows
            );

        } catch (err) {

            error(
                res,
                "Impossible de charger les utilisateurs.",
                500,
                err.message
            );
        }
    }
);


/* ============================================================
   24. USER PAR ID
============================================================ */

async function getUserById(req, res) {

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
                WHERE id=$1
                `,

                [req.params.id]
            );


        if (!result.rows.length) {

            return error(
                res,
                "Utilisateur introuvable.",
                404
            );
        }


        success(
            res,
            result.rows[0]
        );

    } catch (err) {

        error(
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
   25. CRÉER UTILISATEUR
============================================================ */

app.post(
    "/api/utilisateurs",
    async function(req, res) {

        return registerUser(
            req,
            res
        );
    }
);


app.post(
    "/api/users",
    async function(req, res) {

        return registerUser(
            req,
            res
        );
    }
);


/* ============================================================
   26. MODIFIER UTILISATEUR
============================================================ */

async function updateUser(req, res) {

    try {

        const id =
            req.params.id;

        const {

            nom,
            email,
            telephone,
            domaine,
            photo

        } = req.body;


        const result =
            await pool.query(

                `
                UPDATE users

                SET

                    nom =
                        COALESCE($1,nom),

                    email =
                        COALESCE($2,email),

                    telephone =
                        COALESCE($3,telephone),

                    domaine =
                        COALESCE($4,domaine),

                    photo =
                        COALESCE($5,photo),

                    updated_at =
                        CURRENT_TIMESTAMP

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
                    is_blocked
                `,

                [
                    nom ?? null,
                    email ?? null,
                    telephone ?? null,
                    domaine ?? null,
                    photo ?? null,
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
            id
        );


        success(
            res,
            result.rows[0],
            "Utilisateur modifié"
        );

    } catch (err) {

        error(
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
   27. SUPPRIMER UTILISATEUR
============================================================ */

app.delete(
    "/api/utilisateurs/:id",
    adminAuth,
    async function(req, res) {

        try {

            const result =
                await pool.query(

                    `
                    DELETE FROM users
                    WHERE id=$1
                    RETURNING id
                    `,

                    [req.params.id]
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
                `Utilisateur ${req.params.id} supprimé`,
                req.params.id
            );


            success(
                res,
                result.rows[0],
                "Utilisateur supprimé"
            );

        } catch (err) {

            error(
                res,
                "Impossible de supprimer l'utilisateur.",
                500,
                err.message
            );
        }
    }
);


/* ============================================================
   28. PAIEMENTS
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
                function(p) {

                    return {

                        ...p,

                        nom:
                            p.nom ||
                            p.user_nom_db,

                        email:
                            p.email ||
                            p.user_email_db,

                        telephone:
                            p.telephone ||
                            p.user_telephone_db,

                        status:
                            p.status ||
                            "pending"
                    };
                }
            );


        success(
            res,
            data
        );

    } catch (err) {

        error(
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
   29. PAIEMENT PAR ID
============================================================ */

app.get(
    "/api/paiements/:id",
    async function(req, res) {

        try {

            const result =
                await pool.query(

                    `
                    SELECT *
                    FROM paiements
                    WHERE id=$1
                    `,

                    [req.params.id]
                );


            if (!result.rows.length) {

                return error(
                    res,
                    "Paiement introuvable.",
                    404
                );
            }


            success(
                res,
                result.rows[0]
            );

        } catch (err) {

            error(
                res,
                "Erreur paiement.",
                500,
                err.message
            );
        }
    }
);


/* ============================================================
   30. CRÉATION PAIEMENT
============================================================ */

async function createPayment(req, res) {

    try {

        const body =
            req.body || {};


        const userId =
            body.user_id ||
            body.userId ||
            null;


        const amount =
            body.amount ??
            body.montant ??
            0;


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
                    `,

                    [userId]
                );


            if (userResult.rows.length) {

                user =
                    userResult.rows[0];
            }
        }


        const nom =
            body.nom ||
            (user && user.nom) ||
            null;


        const email =
            body.email ||
            (user && user.email) ||
            null;


        const telephone =
            body.telephone ||
            (user && user.telephone) ||
            null;


        const premiumDays =
            Number(
                body.premium_days ||
                body.premiumDays ||
                30
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
                    $1,$2,$3,$4,$5,$5,$6,
                    $7,$7,$8,$8,$9,$9,
                    'pending',$10,$11
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


        await logActivity(
            "CREATE_PAYMENT",
            `Paiement créé pour ${email || "utilisateur"}`,
            userId,
            result.rows[0].id
        );


        success(
            res,
            result.rows[0],
            "Paiement enregistré avec succès"
        );

    } catch (err) {

        error(
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


/* ============================================================
   31. PAIEMENT MANUEL ADMIN
============================================================ */

app.post(
    "/api/paiements/manual",
    adminAuth,
    async function(req, res) {

        return createPayment(
            req,
            res
        );
    }
);


app.post(
    "/api/admin/paiements/manual",
    adminAuth,
    async function(req, res) {

        return createPayment(
            req,
            res
        );
    }
);


/* ============================================================
   32. VALIDATION PAIEMENT
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


        const paymentResult =
            await client.query(

                `
                SELECT *
                FROM paiements
                WHERE id=$1
                FOR UPDATE
                `,

                [req.params.id]
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
                .toLowerCase()
                ===
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
            payment.user_id;


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


        const days =
            Number(
                payment.premium_days ||
                30
            );


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


        /*
           Calcul de la nouvelle date Premium.

           Si l'utilisateur possède déjà une date future,
           on ajoute les jours à cette date.
        */

        const currentUntil =
            user.premium_until
                ? new Date(user.premium_until)
                : new Date();


        const now =
            new Date();


        const baseDate =
            currentUntil > now
                ? currentUntil
                : now;


        const newPremiumUntil =
            new Date(baseDate);


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

                    updated_at=CURRENT_TIMESTAMP

                WHERE id=$1

                RETURNING *
                `,

                [req.params.id]
            );


        await client.query(
            "COMMIT"
        );


        await logActivity(
            "VALIDATE_PAYMENT",
            `Paiement ${req.params.id} validé - Premium activé`,
            userId,
            req.params.id
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
   33. REFUS PAIEMENT
============================================================ */

async function refusePayment(
    req,
    res
) {

    try {

        const reason =
            req.body.reason ||
            req.body.motif ||
            req.body.refusal_reason ||
            "Paiement refusé par l'administrateur";


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

                RETURNING *
                `,

                [
                    reason,
                    req.params.id
                ]
            );


        if (!result.rows.length) {

            return error(
                res,
                "Paiement introuvable.",
                404
            );
        }


        await logActivity(
            "REFUSE_PAYMENT",
            `Paiement ${req.params.id} refusé : ${reason}`,
            result.rows[0].user_id,
            req.params.id
        );


        success(
            res,
            result.rows[0],
            "Paiement refusé"
        );

    } catch (err) {

        error(
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
   34. MODIFIER PAIEMENT
============================================================ */

app.put(
    "/api/paiements/:id",
    adminAuth,
    async function(req, res) {

        try {

            const {

                status,
                reference,
                method,
                methode,
                notes,
                refusal_reason

            } = req.body;


            const result =
                await pool.query(

                    `
                    UPDATE paiements

                    SET

                        status =
                            COALESCE($1,status),

                        reference =
                            COALESCE($2,reference),

                        transaction_id =
                            COALESCE($2,transaction_id),

                        methode =
                            COALESCE($3,methode),

                        method =
                            COALESCE($3,method),

                        notes =
                            COALESCE($4,notes),

                        refusal_reason =
                            COALESCE($5,refusal_reason),

                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE id=$6

                    RETURNING *
                    `,

                    [
                        status || null,
                        reference || null,
                        method || methode || null,
                        notes || null,
                        refusal_reason || null,
                        req.params.id
                    ]
                );


            if (!result.rows.length) {

                return error(
                    res,
                    "Paiement introuvable.",
                    404
                );
            }


            success(
                res,
                result.rows[0],
                "Paiement modifié"
            );

        } catch (err) {

            error(
                res,
                "Impossible de modifier le paiement.",
                500,
                err.message
            );
        }
    }
);


app.patch(
    "/api/paiements/:id",
    adminAuth,
    async function(req, res) {

        req.method = "PUT";

        return app._router.handle(
            req,
            res,
            function() {}
        );
    }
);


/* ============================================================
   35. SUPPRIMER PAIEMENT
============================================================ */

app.delete(
    "/api/paiements/:id",
    adminAuth,
    async function(req, res) {

        try {

            const result =
                await pool.query(

                    `
                    DELETE FROM paiements
                    WHERE id=$1
                    RETURNING id
                    `,

                    [req.params.id]
                );


            if (!result.rows.length) {

                return error(
                    res,
                    "Paiement introuvable.",
                    404
                );
            }


            await logActivity(
                "DELETE_PAYMENT",
                `Paiement ${req.params.id} supprimé`,
                null,
                req.params.id
            );


            success(
                res,
                result.rows[0],
                "Paiement supprimé"
            );

        } catch (err) {

            error(
                res,
                "Impossible de supprimer le paiement.",
                500,
                err.message
            );
        }
    }
);


/* ============================================================
   36. ACTIVER / DÉSACTIVER PREMIUM MANUELLEMENT
============================================================ */

app.patch(
    "/api/admin/users/:id/premium",
    adminAuth,
    async function(req, res) {

        try {

            const enabled =
                req.body.enabled !== undefined
                    ? Boolean(req.body.enabled)
                    : true;


            const days =
                Number(
                    req.body.days ||
                    req.body.premium_days ||
                    30
                );


            let premiumUntil =
                null;


            if (enabled) {

                premiumUntil =
                    new Date();

                premiumUntil.setDate(
                    premiumUntil.getDate() +
                    days
                );
            }


            const result =
                await pool.query(

                    `
                    UPDATE users

                    SET

                        premium=$1,

                        is_premium=$1,

                        premium_until=$2,

                        updated_at=CURRENT_TIMESTAMP

                    WHERE id=$3

                    RETURNING
                        id,
                        nom,
                        email,
                        premium,
                        is_premium,
                        premium_until
                    `,

                    [
                        enabled,
                        premiumUntil,
                        req.params.id
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
                enabled
                    ? "ENABLE_PREMIUM"
                    : "DISABLE_PREMIUM",
                enabled
                    ? `Premium activé pour utilisateur ${req.params.id}`
                    : `Premium désactivé pour utilisateur ${req.params.id}`,
                req.params.id
            );


            success(
                res,
                result.rows[0],
                enabled
                    ? "Premium activé"
                    : "Premium désactivé"
            );

        } catch (err) {

            error(
                res,
                "Impossible de modifier Premium.",
                500,
                err.message
            );
        }
    }
);


/* ============================================================
   37. BLOQUER / DÉBLOQUER
============================================================ */

app.patch(
    "/api/admin/users/:id/block",
    adminAuth,
    async function(req, res) {

        try {

            const blocked =
                req.body.blocked !== undefined
                    ? Boolean(req.body.blocked)
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
                        req.params.id
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
                    ? `Utilisateur ${req.params.id} bloqué`
                    : `Utilisateur ${req.params.id} débloqué`,
                req.params.id
            );


            success(
                res,
                result.rows[0],
                blocked
                    ? "Utilisateur bloqué"
                    : "Utilisateur débloqué"
            );

        } catch (err) {

            error(
                res,
                "Impossible de modifier le blocage.",
                500,
                err.message
            );
        }
    }
);


/* ============================================================
   38. STATISTIQUES ADMIN
============================================================ */

async function statistics(
    req,
    res
) {

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
                WHERE premium=true
                   OR is_premium=true
                `
            );


        const blocked =
            await pool.query(
                `
                SELECT COUNT(*)::int AS total
                FROM users
                WHERE blocked=true
                   OR is_blocked=true
                `
            );


        const payments =
            await pool.query(
                `
                SELECT COUNT(*)::int AS total
                FROM paiements
                `
            );


        const pending =
            await pool.query(
                `
                SELECT COUNT(*)::int AS total
                FROM paiements
                WHERE status='pending'
                `
            );


        const validated =
            await pool.query(
                `
                SELECT COUNT(*)::int AS total
                FROM paiements
                WHERE status='validated'
                `
            );


        const refused =
            await pool.query(
                `
                SELECT COUNT(*)::int AS total
                FROM paiements
                WHERE status='refused'
                `
            );


        const revenue =
            await pool.query(
                `
                SELECT
                    COALESCE(
                        SUM(
                            CASE
                                WHEN status='validated'
                                THEN amount
                                ELSE 0
                            END
                        ),
                        0
                    ) AS total
                FROM paiements
                `
            );


        success(
            res,
            {

                utilisateurs:
                    users.rows[0].total,

                premium:
                    premium.rows[0].total,

                bloques:
                    blocked.rows[0].total,

                paiements:
                    payments.rows[0].total,

                en_attente:
                    pending.rows[0].total,

                valides:
                    validated.rows[0].total,

                refuses:
                    refused.rows[0].total,

                revenus:
                    revenue.rows[0].total
            }
        );

    } catch (err) {

        error(
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
   39. ERREUR 404
============================================================ */

app.use(
    function(req, res) {

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
   40. GESTION ERREURS
============================================================ */

app.use(
    function(err, req, res, next) {

        console.error(
            "Erreur serveur :",
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
   41. DÉMARRAGE
============================================================ */

async function startServer() {

    try {

        await initDatabase();


        app.listen(
            PORT,
            "0.0.0.0",
            function() {

                console.log("");
                console.log(
                    "=================================================="
                );

                console.log(
                    " BMJ SERVICE BACKEND"
                );

                console.log(
                    " VERSION : 11.0.0"
                );

                console.log(
                    ` PORT : ${PORT}`
                );

                console.log(
                    " DATABASE : PostgreSQL"
                );

                console.log(
                    " STATUS : ONLINE"
                );

                console.log(
                    "=================================================="
                );

                console.log(
                    `ADMIN EMAIL : ${ADMIN_EMAIL}`
                );

                console.log(
                    `ADMIN PASSWORD : ${ADMIN_PASSWORD}`
                );

                console.log(
                    "=================================================="
                );

            }
        );

    } catch (err) {

        console.error(
            "Impossible de démarrer le serveur."
        );

        console.error(
            err
        );

        process.exit(1);
    }
}


startServer();