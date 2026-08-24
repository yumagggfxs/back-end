/* =========================================================
   BMJ SERVICE
   BACKEND API COMPLET
   NODE.JS + EXPRESS + POSTGRESQL
   RENDER

   VERSION : 10.0.0

   =========================================================
   FONCTIONNALITES
   ---------------------------------------------------------
   - PostgreSQL
   - Création automatique des tables
   - Migration automatique des colonnes
   - Inscription utilisateur
   - Connexion utilisateur
   - Connexion ADMIN
   - Gestion utilisateurs
   - Gestion Premium
   - Gestion administrateurs
   - Blocage utilisateur
   - Suppression utilisateur
   - Gestion paiements
   - Validation paiement
   - Activation Premium
   - Refus paiement
   - Suppression paiement
   - Statistiques ADMIN
   - Dashboard ADMIN complet
   - Routes ADMIN dédiées
   - Compatibilité anciennes routes
   - Compatibilité anciens noms de champs
   - CORS
   - Logs
   - Health check
========================================================= */

"use strict";


/* =========================================================
   1. IMPORTS
========================================================= */

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { Pool } = require("pg");


/* =========================================================
   2. APPLICATION
========================================================= */

const app = express();

const PORT =
    process.env.PORT || 10000;


/* =========================================================
   3. POSTGRESQL
========================================================= */

const DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://bmj_db_user:5FSX8YeJNzwinKdFOrIeEC43aQsuzf91@dpg-d9sdlt49v7es73emrq8g-a/bmj_db";


const pool = new Pool({

    connectionString:
        DATABASE_URL,

    ssl: {
        rejectUnauthorized: false
    },

    max: 10,

    idleTimeoutMillis:
        30000,

    connectionTimeoutMillis:
        15000

});


/* =========================================================
   4. ADMIN CONFIGURATION
========================================================= */

/*
   SUR RENDER :

   ADMIN_EMAIL
   ADMIN_PASSWORD

   Exemple :

   ADMIN_EMAIL=admin@bmjservice.com
   ADMIN_PASSWORD=TON_MOT_DE_PASSE

   Tu peux aussi créer un administrateur directement
   dans PostgreSQL avec is_admin=true.
*/

const ADMIN_EMAIL =
    nettoyerEmail(
        process.env.ADMIN_EMAIL || ""
    );

const ADMIN_PASSWORD =
    String(
        process.env.ADMIN_PASSWORD || ""
    );


/*
   Sessions administrateur en mémoire.

   Le token est renouvelé lors d'une nouvelle connexion.
   Pour une architecture plus avancée, on pourra ensuite
   utiliser JWT ou une table de sessions.
*/

const sessionsAdmin =
    new Map();


/* =========================================================
   5. MIDDLEWARES
========================================================= */

app.use(

    cors({

        origin: "*",

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

        limit:
            "20mb"

    })

);


app.use(

    express.urlencoded({

        extended:
            true,

        limit:
            "20mb"

    })

);


/* =========================================================
   6. LOGS
========================================================= */

app.use(

    (req, res, next) => {

        const debut =
            Date.now();


        res.on(

            "finish",

            () => {

                const duree =
                    Date.now() - debut;

                console.log(

                    `[BMJ API] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duree}ms)`

                );

            }

        );


        next();

    }

);


/* =========================================================
   7. OUTILS
========================================================= */

function succes(

    res,
    data = null,
    message = "Opération réussie."

) {

    return res.json({

        success:
            true,

        message,

        data,

        /*
           Compatibilité frontend.

           Certains anciens dashboards utilisent directement
           utilisateurs, paiements ou statistiques.
        */

        utilisateurs:
            Array.isArray(data)
                ? data
                : undefined,

        users:
            Array.isArray(data)
                ? data
                : undefined,

        paiements:
            Array.isArray(data)
                ? data
                : undefined,

        payments:
            Array.isArray(data)
                ? data
                : undefined

    });

}


function erreur(

    res,
    status = 500,
    message = "Une erreur est survenue.",
    error = null

) {

    console.error(

        "[BMJ ERROR]",

        message,

        error?.message ||
        error ||
        ""

    );


    return res.status(status).json({

        success:
            false,

        message,

        error:
            process.env.NODE_ENV === "production"
                ? ""
                : (
                    error?.message ||
                    String(error || "")
                )

    });

}


function premier(

    objet,
    ...cles

) {

    if (!objet) {

        return null;

    }


    for (

        const cle of cles

    ) {

        if (

            objet[cle] !== undefined &&
            objet[cle] !== null

        ) {

            return objet[cle];

        }

    }


    return null;

}


function booleanValeur(

    value

) {

    return (

        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true" ||
        value === "TRUE" ||
        value === "yes" ||
        value === "oui"

    );

}


function entier(

    valeur

) {

    const n =
        Number(valeur);

    return Number.isInteger(n)
        ? n
        : null;

}


function montantValide(

    valeur

) {

    const n =
        Number(valeur);


    if (

        !Number.isFinite(n) ||
        n <= 0

    ) {

        return null;

    }


    return n;

}


function nettoyerEmail(

    email

) {

    return String(

        email || ""

    )
        .trim()
        .toLowerCase();

}


/* =========================================================
   8. NORMALISATION UTILISATEUR
========================================================= */

function utilisateurJSON(

    row

) {

    if (!row) {

        return null;

    }


    const premium =
        Boolean(

            row.premium ||
            row.is_premium

        );


    const bloque =
        Boolean(

            row.bloque

        );


    const isAdmin =
        Boolean(

            row.is_admin

        ) ||
        String(
            row.role || ""
        ).toLowerCase() === "admin";


    return {

        ...row,

        id:
            row.id,

        utilisateurID:
            row.id,

        utilisateur_id:
            row.id,

        user_id:
            row.id,

        userId:
            row.id,

        userID:
            row.id,

        nom:
            row.nom || "",

        name:
            row.nom || "",

        email:
            row.email || "",

        telephone:
            row.telephone || "",

        phone:
            row.telephone || "",

        domaine:
            row.domaine || "",

        photo:
            row.photo || "",

        premium,

        is_premium:
            premium,

        isPremium:
            premium,

        bloque,

        blocked:
            bloque,

        is_admin:
            isAdmin,

        isAdmin,

        admin:
            isAdmin,

        role:
            row.role ||
            (isAdmin ? "admin" : "user")

    };

}


/* =========================================================
   9. NORMALISATION PAIEMENT
========================================================= */

function paiementJSON(

    row

) {

    if (!row) {

        return null;

    }


    const montant =
        Number(
            row.montant || 0
        );


    const statut =
        row.statut ||
        "en_attente";


    const preuve =
        row.preuve ||
        "";


    const reference =
        row.reference ||
        "";


    return {

        ...row,

        id:
            row.id,

        paiement_id:
            row.id,

        paiementId:
            row.id,

        utilisateurID:
            row.utilisateur_id,

        utilisateur_id:
            row.utilisateur_id,

        user_id:
            row.utilisateur_id,

        userId:
            row.utilisateur_id,

        userID:
            row.utilisateur_id,

        nom:
            row.nom || "",

        name:
            row.nom || "",

        email:
            row.email || "",

        telephone:
            row.telephone || "",

        phone:
            row.telephone || "",

        montant,

        amount:
            montant,

        devise:
            row.devise || "USD",

        currency:
            row.devise || "USD",

        methode:
            row.methode || "",

        method:
            row.methode || "",

        payment_method:
            row.methode || "",

        numero_operateur:
            row.numero_operateur || "",

        numeroOperateur:
            row.numero_operateur || "",

        operator_number:
            row.numero_operateur || "",

        statut,

        status:
            statut,

        etat:
            statut,

        date_paiement:
            row.date_paiement ||
            row.created_at,

        date:
            row.date_paiement ||
            row.created_at,

        datePaiement:
            row.date_paiement ||
            row.created_at,

        reference,

        transaction_id:
            reference,

        transactionId:
            reference,

        preuve,

        proof:
            preuve,

        capture:
            preuve,

        image:
            preuve,

        preuve_paiement:
            preuve,

        capture_paiement:
            preuve,

        note:
            row.note || "",

        commentaire:
            row.commentaire ||
            row.note ||
            ""

    };

}


/* =========================================================
   10. TEST DATABASE
========================================================= */

async function testerDB() {

    const result =
        await pool.query(

            "SELECT NOW() AS maintenant"

        );


    return result.rows[0];

}


/* =========================================================
   11. TABLE UTILISATEURS
========================================================= */

async function creerTableUtilisateurs() {

    await pool.query(`

        CREATE TABLE IF NOT EXISTS utilisateurs (

            id SERIAL PRIMARY KEY,

            nom TEXT NOT NULL DEFAULT '',

            email TEXT NOT NULL DEFAULT '',

            telephone TEXT NOT NULL DEFAULT '',

            mot_de_passe TEXT DEFAULT '',

            domaine TEXT DEFAULT '',

            photo TEXT DEFAULT '',

            premium BOOLEAN NOT NULL DEFAULT FALSE,

            is_premium BOOLEAN NOT NULL DEFAULT FALSE,

            bloque BOOLEAN NOT NULL DEFAULT FALSE,

            is_admin BOOLEAN NOT NULL DEFAULT FALSE,

            role TEXT NOT NULL DEFAULT 'user',

            created_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW(),

            updated_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW()

        )

    `);

}


/* =========================================================
   12. TABLE PAIEMENTS
========================================================= */

async function creerTablePaiements() {

    await pool.query(`

        CREATE TABLE IF NOT EXISTS paiements (

            id SERIAL PRIMARY KEY,

            utilisateur_id INTEGER
                REFERENCES utilisateurs(id)
                ON DELETE SET NULL,

            nom TEXT DEFAULT '',

            email TEXT DEFAULT '',

            telephone TEXT DEFAULT '',

            montant NUMERIC(15,2)
                NOT NULL DEFAULT 0,

            devise TEXT
                NOT NULL DEFAULT 'USD',

            methode TEXT DEFAULT '',

            numero_operateur TEXT DEFAULT '',

            statut TEXT
                NOT NULL DEFAULT 'en_attente',

            date_paiement TIMESTAMPTZ
                DEFAULT NOW(),

            reference TEXT DEFAULT '',

            preuve TEXT DEFAULT '',

            origine TEXT DEFAULT '',

            source TEXT DEFAULT '',

            ajoute_par_admin BOOLEAN
                NOT NULL DEFAULT FALSE,

            added_by_admin BOOLEAN
                NOT NULL DEFAULT FALSE,

            note TEXT DEFAULT '',

            commentaire TEXT DEFAULT '',

            created_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW(),

            updated_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW()

        )

    `);

}


/* =========================================================
   13. MIGRATION UTILISATEURS
========================================================= */

async function migrerUtilisateurs() {

    const colonnes = [

        [
            "mot_de_passe",
            "TEXT DEFAULT ''"
        ],

        [
            "domaine",
            "TEXT DEFAULT ''"
        ],

        [
            "photo",
            "TEXT DEFAULT ''"
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
            "bloque",
            "BOOLEAN NOT NULL DEFAULT FALSE"
        ],

        [
            "is_admin",
            "BOOLEAN NOT NULL DEFAULT FALSE"
        ],

        [
            "role",
            "TEXT NOT NULL DEFAULT 'user'"
        ],

        [
            "created_at",
            "TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        ],

        [
            "updated_at",
            "TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        ]

    ];


    for (

        const [nom, type]
        of colonnes

    ) {

        await pool.query(`

            ALTER TABLE utilisateurs

            ADD COLUMN IF NOT EXISTS
            ${nom}
            ${type}

        `);

    }


    /*
       Synchronisation des comptes anciens.
    */

    await pool.query(`

        UPDATE utilisateurs

        SET is_premium = TRUE

        WHERE premium = TRUE

    `);


    await pool.query(`

        UPDATE utilisateurs

        SET premium = TRUE

        WHERE is_premium = TRUE

    `);


    await pool.query(`

        UPDATE utilisateurs

        SET role = 'admin'

        WHERE is_admin = TRUE

    `);


    await pool.query(`

        UPDATE utilisateurs

        SET is_admin = TRUE

        WHERE LOWER(role) = 'admin'

    `);

}


/* =========================================================
   14. MIGRATION PAIEMENTS
========================================================= */

async function migrerPaiements() {

    const colonnes = [

        [
            "utilisateur_id",
            "INTEGER"
        ],

        [
            "nom",
            "TEXT DEFAULT ''"
        ],

        [
            "email",
            "TEXT DEFAULT ''"
        ],

        [
            "telephone",
            "TEXT DEFAULT ''"
        ],

        [
            "montant",
            "NUMERIC(15,2) NOT NULL DEFAULT 0"
        ],

        [
            "devise",
            "TEXT NOT NULL DEFAULT 'USD'"
        ],

        [
            "methode",
            "TEXT DEFAULT ''"
        ],

        [
            "numero_operateur",
            "TEXT DEFAULT ''"
        ],

        [
            "statut",
            "TEXT NOT NULL DEFAULT 'en_attente'"
        ],

        [
            "date_paiement",
            "TIMESTAMPTZ DEFAULT NOW()"
        ],

        [
            "reference",
            "TEXT DEFAULT ''"
        ],

        [
            "preuve",
            "TEXT DEFAULT ''"
        ],

        [
            "origine",
            "TEXT DEFAULT ''"
        ],

        [
            "source",
            "TEXT DEFAULT ''"
        ],

        [
            "ajoute_par_admin",
            "BOOLEAN NOT NULL DEFAULT FALSE"
        ],

        [
            "added_by_admin",
            "BOOLEAN NOT NULL DEFAULT FALSE"
        ],

        [
            "note",
            "TEXT DEFAULT ''"
        ],

        [
            "commentaire",
            "TEXT DEFAULT ''"
        ],

        [
            "created_at",
            "TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        ],

        [
            "updated_at",
            "TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        ]

    ];


    for (

        const [nom, type]
        of colonnes

    ) {

        await pool.query(`

            ALTER TABLE paiements

            ADD COLUMN IF NOT EXISTS
            ${nom}
            ${type}

        `);

    }

}


/* =========================================================
   15. INDEX
========================================================= */

async function creerIndexes() {

    await pool.query(`

        CREATE INDEX IF NOT EXISTS
        idx_utilisateurs_email

        ON utilisateurs(email)

    `);


    await pool.query(`

        CREATE INDEX IF NOT EXISTS
        idx_utilisateurs_telephone

        ON utilisateurs(telephone)

    `);


    await pool.query(`

        CREATE INDEX IF NOT EXISTS
        idx_utilisateurs_admin

        ON utilisateurs(is_admin)

    `);


    await pool.query(`

        CREATE INDEX IF NOT EXISTS
        idx_paiements_utilisateur

        ON paiements(utilisateur_id)

    `);


    await pool.query(`

        CREATE INDEX IF NOT EXISTS
        idx_paiements_statut

        ON paiements(statut)

    `);


    await pool.query(`

        CREATE INDEX IF NOT EXISTS
        idx_paiements_date

        ON paiements(date_paiement DESC)

    `);

}


/* =========================================================
   16. INITIALISATION
========================================================= */

async function initialiserBase() {

    console.log(
        "Initialisation PostgreSQL..."
    );


    await creerTableUtilisateurs();

    await creerTablePaiements();

    await migrerUtilisateurs();

    await migrerPaiements();

    await creerIndexes();


    console.log(
        "PostgreSQL : tables et migrations OK."
    );

}


/* =========================================================
   17. CREATION ADMIN ENV
========================================================= */

async function creerAdminDepuisEnv() {

    if (
        !ADMIN_EMAIL ||
        !ADMIN_PASSWORD
    ) {

        console.log(
            "ADMIN_EMAIL / ADMIN_PASSWORD non configurés."
        );

        return;

    }


    try {

        const recherche =
            await pool.query(

                `

                SELECT *

                FROM utilisateurs

                WHERE LOWER(email) = LOWER($1)

                LIMIT 1

                `,

                [ADMIN_EMAIL]

            );


        if (
            recherche.rows.length
        ) {

            await pool.query(

                `

                UPDATE utilisateurs

                SET

                    is_admin = TRUE,

                    role = 'admin',

                    updated_at = NOW()

                WHERE LOWER(email) = LOWER($1)

                `,

                [ADMIN_EMAIL]

            );


            console.log(
                "Compte ADMIN existant activé :",
                ADMIN_EMAIL
            );

            return;

        }


        await pool.query(

            `

            INSERT INTO utilisateurs (

                nom,
                email,
                telephone,
                mot_de_passe,
                domaine,
                photo,
                premium,
                is_premium,
                bloque,
                is_admin,
                role

            )

            VALUES (

                'Administrateur BMJ',
                $1,
                '',
                $2,
                'Administration',
                '',
                TRUE,
                TRUE,
                FALSE,
                TRUE,
                'admin'

            )

            `,

            [
                ADMIN_EMAIL,
                ADMIN_PASSWORD
            ]

        );


        console.log(
            "Compte ADMIN créé :",
            ADMIN_EMAIL
        );

    }

    catch (error) {

        console.error(
            "Erreur création ADMIN :",
            error.message
        );

    }

}


/* =========================================================
   18. AUTH ADMIN
========================================================= */

function extraireToken(req) {

    const authorization =
        req.headers.authorization || "";


    if (
        !authorization
    ) {

        return null;

    }


    if (
        authorization
            .toLowerCase()
            .startsWith("bearer ")

    ) {

        return authorization
            .substring(7)
            .trim();

    }


    return authorization.trim();

}


/* =========================================================
   19. MIDDLEWARE ADMIN
========================================================= */

async function verifierAdmin(

    req,
    res,
    next

) {

    try {

        const token =
            extraireToken(req);


        /*
           Auth par session token.
        */

        if (
            token &&
            sessionsAdmin.has(token)
        ) {

            const session =
                sessionsAdmin.get(token);


            if (
                session.expiration >
                Date.now()
            ) {

                req.admin =
                    session.admin;

                return next();

            }


            sessionsAdmin.delete(token);

        }


        /*
           Auth directe via compte admin.

           Cela permet aussi au frontend ancien
           de continuer à fonctionner s'il envoie
           email + mot de passe.
        */

        const email =
            nettoyerEmail(

                premier(

                    req.body,

                    "email",
                    "mail",
                    "username"

                )

            );


        const password =
            String(

                premier(

                    req.body,

                    "mot_de_passe",
                    "motDePasse",
                    "password",
                    "pass",
                    "pwd"

                ) || ""

            );


        if (
            email &&
            password
        ) {

            const result =
                await pool.query(

                    `

                    SELECT *

                    FROM utilisateurs

                    WHERE LOWER(email) = LOWER($1)

                    AND (

                        is_admin = TRUE

                        OR

                        LOWER(role) = 'admin'

                    )

                    LIMIT 1

                    `,

                    [email]

                );


            if (
                result.rows.length
            ) {

                const admin =
                    result.rows[0];


                if (
                    String(
                        admin.mot_de_passe || ""
                    ) === password
                ) {

                    req.admin =
                        utilisateurJSON(admin);

                    return next();

                }

            }


            /*
               Compte admin configuré par Render.
            */

            if (
                ADMIN_EMAIL &&
                ADMIN_PASSWORD &&
                email === ADMIN_EMAIL &&
                password === ADMIN_PASSWORD
            ) {

                req.admin = {

                    email:
                        ADMIN_EMAIL,

                    role:
                        "admin",

                    is_admin:
                        true,

                    isAdmin:
                        true

                };

                return next();

            }

        }


        return erreur(

            res,
            401,
            "Accès administrateur non autorisé."

        );

    }

    catch (error) {

        return erreur(

            res,
            500,
            "Erreur de vérification administrateur.",
            error

        );

    }

}


/* =========================================================
   20. RACINE
========================================================= */

app.get(

    "/",

    async (req, res) => {

        let database =
            "offline";


        try {

            await testerDB();

            database =
                "online";

        }

        catch (error) {

            console.error(
                error.message
            );

        }


        return res.json({

            success:
                true,

            message:
                "BMJ SERVICE API fonctionne.",

            version:
                "10.0.0",

            server:
                "Node.js + Express",

            database,

            status:
                "online",

            routes:
                "/api/routes"

        });

    }

);


/* =========================================================
   21. API
========================================================= */

app.get(

    "/api",

    (req, res) => {

        return res.json({

            success:
                true,

            message:
                "BMJ SERVICE API",

            version:
                "10.0.0",

            database:
                "PostgreSQL",

            routes:
                "/api/routes",

            admin_login:
                "/api/admin/connexion",

            admin_dashboard:
                "/api/admin/dashboard"

        });

    }

);


/* =========================================================
   22. ROUTES
========================================================= */

app.get(

    "/api/routes",

    (req, res) => {

        return res.json({

            success:
                true,

            version:
                "10.0.0",

            routes: [

                {
                    method: "GET",
                    path: "/"
                },

                {
                    method: "GET",
                    path: "/api"
                },

                {
                    method: "GET",
                    path: "/api/routes"
                },

                {
                    method: "GET",
                    path: "/api/health"
                },

                {
                    method: "GET",
                    path: "/api/test-db"
                },


                /* AUTH */

                {
                    method: "POST",
                    path: "/api/inscription"
                },

                {
                    method: "POST",
                    path: "/api/register"
                },

                {
                    method: "POST",
                    path: "/api/signup"
                },

                {
                    method: "POST",
                    path: "/api/connexion"
                },

                {
                    method: "POST",
                    path: "/api/login"
                },

                {
                    method: "POST",
                    path: "/api/signin"
                },


                /* ADMIN AUTH */

                {
                    method: "POST",
                    path: "/api/admin/connexion"
                },

                {
                    method: "POST",
                    path: "/api/admin/login"
                },

                {
                    method: "POST",
                    path: "/api/admin/signin"
                },

                {
                    method: "POST",
                    path: "/api/admin/logout"
                },

                {
                    method: "GET",
                    path: "/api/admin/me"
                },


                /* ADMIN DATA */

                {
                    method: "GET",
                    path: "/api/admin/dashboard"
                },

                {
                    method: "GET",
                    path: "/api/admin/utilisateurs"
                },

                {
                    method: "GET",
                    path: "/api/admin/users"
                },

                {
                    method: "GET",
                    path: "/api/admin/paiements"
                },

                {
                    method: "GET",
                    path: "/api/admin/payments"
                },

                {
                    method: "GET",
                    path: "/api/admin/statistiques"
                },


                /* UTILISATEURS */

                {
                    method: "GET",
                    path: "/api/utilisateurs"
                },

                {
                    method: "GET",
                    path: "/api/utilisateurs/:id"
                },

                {
                    method: "POST",
                    path: "/api/utilisateurs"
                },

                {
                    method: "PUT",
                    path: "/api/utilisateurs/:id"
                },

                {
                    method: "PATCH",
                    path: "/api/utilisateurs/:id"
                },

                {
                    method: "DELETE",
                    path: "/api/utilisateurs/:id"
                },


                /* USERS */

                {
                    method: "GET",
                    path: "/api/users"
                },

                {
                    method: "GET",
                    path: "/api/users/:id"
                },

                {
                    method: "POST",
                    path: "/api/users"
                },


                /* PAIEMENTS */

                {
                    method: "GET",
                    path: "/api/paiements"
                },

                {
                    method: "GET",
                    path: "/api/paiements/:id"
                },

                {
                    method: "POST",
                    path: "/api/paiements"
                },

                {
                    method: "PUT",
                    path: "/api/paiements/:id"
                },

                {
                    method: "PATCH",
                    path: "/api/paiements/:id"
                },

                {
                    method: "DELETE",
                    path: "/api/paiements/:id"
                },

                {
                    method: "PATCH",
                    path: "/api/paiements/:id/valider"
                },

                {
                    method: "PATCH",
                    path: "/api/paiements/:id/refuser"
                },


                /* STATISTIQUES */

                {
                    method: "GET",
                    path: "/api/statistiques"
                }

            ]

        });

    }

);


/* =========================================================
   23. HEALTH
========================================================= */

app.get(

    "/api/health",

    async (req, res) => {

        try {

            await pool.query(
                "SELECT 1"
            );


            return res.json({

                success:
                    true,

                status:
                    "online",

                database:
                    "online",

                version:
                    "10.0.0",

                timestamp:
                    new Date().toISOString()

            });

        }

        catch (error) {

            return res.status(503).json({

                success:
                    false,

                status:
                    "offline",

                database:
                    "offline",

                error:
                    error.message,

                timestamp:
                    new Date().toISOString()

            });

        }

    }

);


/* =========================================================
   24. TEST DB
========================================================= */

app.get(

    "/api/test-db",

    async (req, res) => {

        try {

            const result =
                await testerDB();


            return res.json({

                success:
                    true,

                message:
                    "PostgreSQL fonctionne.",

                database:
                    result.maintenant

            });

        }

        catch (error) {

            return erreur(

                res,
                500,
                "Erreur PostgreSQL.",
                error

            );

        }

    }

);


/* =========================================================
   25. INSCRIPTION
========================================================= */

async function inscrireUtilisateur(

    req,
    res

) {

    try {

        const body =
            req.body || {};


        const nom =
            String(

                premier(
                    body,
                    "nom",
                    "name",
                    "full_name",
                    "fullname"
                ) || ""

            ).trim();


        const email =
            nettoyerEmail(

                premier(
                    body,
                    "email",
                    "mail"
                )

            );


        const telephone =
            String(

                premier(
                    body,
                    "telephone",
                    "phone",
                    "tel",
                    "numero"
                ) || ""

            ).trim();


        const motDePasse =
            String(

                premier(
                    body,
                    "mot_de_passe",
                    "motDePasse",
                    "password",
                    "pass",
                    "pwd"
                ) || ""

            );


        const domaine =
            String(

                premier(
                    body,
                    "domaine",
                    "domain",
                    "profession"
                ) || ""

            ).trim();


        const photo =
            String(

                premier(
                    body,
                    "photo",
                    "image",
                    "profile",
                    "avatar"
                ) || ""

            );


        if (!nom) {

            return erreur(
                res,
                400,
                "Le nom est obligatoire."
            );

        }


        if (!email) {

            return erreur(
                res,
                400,
                "L'adresse email est obligatoire."
            );

        }


        if (!email.includes("@")) {

            return erreur(
                res,
                400,
                "Adresse email invalide."
            );

        }


        if (!motDePasse) {

            return erreur(
                res,
                400,
                "Le mot de passe est obligatoire."
            );

        }


        if (motDePasse.length < 4) {

            return erreur(
                res,
                400,
                "Le mot de passe doit contenir au moins 4 caractères."
            );

        }


        const emailExistant =
            await pool.query(

                `

                SELECT id

                FROM utilisateurs

                WHERE LOWER(email) = LOWER($1)

                LIMIT 1

                `,

                [email]

            );


        if (
            emailExistant.rows.length
        ) {

            return erreur(
                res,
                409,
                "Cette adresse email est déjà utilisée."
            );

        }


        const result =
            await pool.query(

                `

                INSERT INTO utilisateurs (

                    nom,
                    email,
                    telephone,
                    mot_de_passe,
                    domaine,
                    photo,
                    premium,
                    is_premium,
                    bloque,
                    is_admin,
                    role

                )

                VALUES (

                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    FALSE,
                    FALSE,
                    FALSE,
                    FALSE,
                    'user'

                )

                RETURNING *

                `,

                [
                    nom,
                    email,
                    telephone,
                    motDePasse,
                    domaine,
                    photo
                ]

            );


        return succes(

            res,

            utilisateurJSON(
                result.rows[0]
            ),

            "Inscription réussie."

        );

    }

    catch (error) {

        return erreur(

            res,
            500,
            "Impossible de créer le compte.",
            error

        );

    }

}


app.post(
    "/api/inscription",
    inscrireUtilisateur
);

app.post(
    "/api/register",
    inscrireUtilisateur
);

app.post(
    "/api/signup",
    inscrireUtilisateur
);


/* =========================================================
   26. CONNEXION UTILISATEUR
========================================================= */

async function connecterUtilisateur(

    req,
    res

) {

    try {

        const body =
            req.body || {};


        const email =
            nettoyerEmail(

                premier(
                    body,
                    "email",
                    "mail",
                    "username"
                )

            );


        const motDePasse =
            String(

                premier(
                    body,
                    "mot_de_passe",
                    "motDePasse",
                    "password",
                    "pass",
                    "pwd"
                ) || ""

            );


        if (!email) {

            return erreur(
                res,
                400,
                "L'adresse email est obligatoire."
            );

        }


        if (!motDePasse) {

            return erreur(
                res,
                400,
                "Le mot de passe est obligatoire."
            );

        }


        const result =
            await pool.query(

                `

                SELECT *

                FROM utilisateurs

                WHERE LOWER(email) = LOWER($1)

                LIMIT 1

                `,

                [email]

            );


        if (
            !result.rows.length
        ) {

            return erreur(
                res,
                401,
                "Email ou mot de passe incorrect."
            );

        }


        const utilisateur =
            result.rows[0];


        if (

            String(
                utilisateur.mot_de_passe || ""
            ) !== motDePasse

        ) {

            return erreur(
                res,
                401,
                "Email ou mot de passe incorrect."
            );

        }


        if (
            utilisateur.bloque === true
        ) {

            return erreur(
                res,
                403,
                "Ce compte est bloqué."
            );

        }


        return succes(

            res,

            utilisateurJSON(
                utilisateur
            ),

            "Connexion réussie."

        );

    }

    catch (error) {

        return erreur(

            res,
            500,
            "Impossible de se connecter.",
            error

        );

    }

}


app.post(
    "/api/connexion",
    connecterUtilisateur
);

app.post(
    "/api/login",
    connecterUtilisateur
);

app.post(
    "/api/signin",
    connecterUtilisateur
);


/* =========================================================
   27. CONNEXION ADMIN
========================================================= */

async function connexionAdmin(

    req,
    res

) {

    try {

        const body =
            req.body || {};


        const email =
            nettoyerEmail(

                premier(
                    body,
                    "email",
                    "mail",
                    "username"
                )

            );


        const password =
            String(

                premier(
                    body,
                    "mot_de_passe",
                    "motDePasse",
                    "password",
                    "pass",
                    "pwd"
                ) || ""

            );


        if (!email) {

            return erreur(
                res,
                400,
                "Email administrateur obligatoire."
            );

        }


        if (!password) {

            return erreur(
                res,
                400,
                "Mot de passe administrateur obligatoire."
            );

        }


        /*
           1. Vérification du compte admin PostgreSQL.
        */

        const result =
            await pool.query(

                `

                SELECT *

                FROM utilisateurs

                WHERE LOWER(email) = LOWER($1)

                AND (

                    is_admin = TRUE

                    OR

                    LOWER(role) = 'admin'

                )

                LIMIT 1

                `,

                [email]

            );


        let admin =
            null;


        if (
            result.rows.length
        ) {

            const candidat =
                result.rows[0];


            if (

                String(
                    candidat.mot_de_passe || ""
                ) === password

            ) {

                admin =
                    candidat;

            }

        }


        /*
           2. Vérification des identifiants Render.
        */

        if (
            !admin &&
            ADMIN_EMAIL &&
            ADMIN_PASSWORD &&
            email === ADMIN_EMAIL &&
            password === ADMIN_PASSWORD
        ) {

            const resultEnv =
                await pool.query(

                    `

                    SELECT *

                    FROM utilisateurs

                    WHERE LOWER(email) = LOWER($1)

                    LIMIT 1

                    `,

                    [ADMIN_EMAIL]

                );


            if (
                resultEnv.rows.length
            ) {

                admin =
                    resultEnv.rows[0];

            }

        }


        if (!admin) {

            return erreur(
                res,
                401,
                "Identifiants administrateur incorrects."
            );

        }


        if (
            admin.bloque === true
        ) {

            return erreur(
                res,
                403,
                "Le compte administrateur est bloqué."
            );

        }


        /*
           S'assurer que le compte est admin.
        */

        await pool.query(

            `

            UPDATE utilisateurs

            SET

                is_admin = TRUE,

                role = 'admin',

                updated_at = NOW()

            WHERE id = $1

            `,

            [admin.id]

        );


        /*
           Création token.
        */

        const token =
            crypto.randomBytes(48).toString("hex");


        const adminJSON =
            utilisateurJSON({

                ...admin,

                is_admin:
                    true,

                role:
                    "admin"

            });


        sessionsAdmin.set(

            token,

            {

                admin:
                    adminJSON,

                expiration:
                    Date.now() +
                    (
                        24 *
                        60 *
                        60 *
                        1000
                    )

            }

        );


        return res.json({

            success:
                true,

            message:
                "Connexion administrateur réussie.",

            token,

            access_token:
                token,

            admin:
                adminJSON,

            data:
                adminJSON,

            is_admin:
                true,

            isAdmin:
                true,

            role:
                "admin"

        });

    }

    catch (error) {

        return erreur(

            res,
            500,
            "Impossible de connecter l'administrateur.",
            error

        );

    }

}


app.post(
    "/api/admin/connexion",
    connexionAdmin
);

app.post(
    "/api/admin/login",
    connexionAdmin
);

app.post(
    "/api/admin/signin",
    connexionAdmin
);


/* =========================================================
   28. ADMIN ME
========================================================= */

app.get(

    "/api/admin/me",

    verifierAdmin,

    (req, res) => {

        return res.json({

            success:
                true,

            message:
                "Administrateur authentifié.",

            admin:
                req.admin,

            data:
                req.admin,

            is_admin:
                true,

            isAdmin:
                true,

            role:
                "admin"

        });

    }

);


/* =========================================================
   29. ADMIN LOGOUT
========================================================= */

app.post(

    "/api/admin/logout",

    (req, res) => {

        const token =
            extraireToken(req);


        if (token) {

            sessionsAdmin.delete(
                token
            );

        }


        return res.json({

            success:
                true,

            message:
                "Déconnexion administrateur réussie."

        });

    }

);


/* =========================================================
   30. GET UTILISATEURS
========================================================= */

async function recupererUtilisateurs(

    req,
    res

) {

    try {

        const result =
            await pool.query(`

                SELECT *

                FROM utilisateurs

                ORDER BY id DESC

            `);


        const utilisateurs =
            result.rows.map(
                utilisateurJSON
            );


        return res.json({

            success:
                true,

            message:
                "Utilisateurs récupérés.",

            data:
                utilisateurs,

            utilisateurs,

            users:
                utilisateurs,

            total:
                utilisateurs.length

        });

    }

    catch (error) {

        return erreur(

            res,
            500,
            "Impossible de récupérer les utilisateurs.",
            error

        );

    }

}


app.get(
    "/api/utilisateurs",
    recupererUtilisateurs
);

app.get(
    "/api/users",
    recupererUtilisateurs
);


/* =========================================================
   31. ROUTE ADMIN UTILISATEURS
========================================================= */

app.get(

    "/api/admin/utilisateurs",

    verifierAdmin,

    recupererUtilisateurs

);


app.get(

    "/api/admin/users",

    verifierAdmin,

    recupererUtilisateurs

);


/* =========================================================
   32. UTILISATEUR PAR ID
========================================================= */

async function recupererUtilisateur(

    req,
    res

) {

    try {

        const id =
            entier(
                req.params.id
            );


        if (!id) {

            return erreur(
                res,
                400,
                "ID utilisateur invalide."
            );

        }


        const result =
            await pool.query(

                `

                SELECT *

                FROM utilisateurs

                WHERE id = $1

                `,

                [id]

            );


        if (
            !result.rows.length
        ) {

            return erreur(
                res,
                404,
                "Utilisateur introuvable."
            );

        }


        const utilisateur =
            utilisateurJSON(
                result.rows[0]
            );


        return res.json({

            success:
                true,

            message:
                "Utilisateur récupéré.",

            data:
                utilisateur,

            utilisateur,

            user:
                utilisateur

        });

    }

    catch (error) {

        return erreur(

            res,
            500,
            "Impossible de récupérer l'utilisateur.",
            error

        );

    }

}


app.get(
    "/api/utilisateurs/:id",
    recupererUtilisateur
);

app.get(
    "/api/users/:id",
    recupererUtilisateur
);

app.get(
    "/api/user/:id",
    recupererUtilisateur
);

app.get(
    "/api/utilisateur/:id",
    recupererUtilisateur
);


/* =========================================================
   33. ADMIN UTILISATEUR ID
========================================================= */

app.get(

    "/api/admin/utilisateurs/:id",

    verifierAdmin,

    recupererUtilisateur

);


/* =========================================================
   34. GET PAIEMENTS
========================================================= */

async function recupererPaiements(

    req,
    res

) {

    try {

        const result =
            await pool.query(`

                SELECT

                    p.id,

                    p.utilisateur_id,

                    COALESCE(
                        u.nom,
                        p.nom,
                        ''
                    ) AS nom,

                    COALESCE(
                        u.email,
                        p.email,
                        ''
                    ) AS email,

                    COALESCE(
                        u.telephone,
                        p.telephone,
                        ''
                    ) AS telephone,

                    p.montant,

                    p.devise,

                    p.methode,

                    p.numero_operateur,

                    p.statut,

                    p.date_paiement,

                    p.reference,

                    p.preuve,

                    p.origine,

                    p.source,

                    p.ajoute_par_admin,

                    p.added_by_admin,

                    p.note,

                    p.commentaire,

                    p.created_at,

                    p.updated_at

                FROM paiements p

                LEFT JOIN utilisateurs u

                    ON u.id =
                       p.utilisateur_id

                ORDER BY

                    p.date_paiement
                    DESC NULLS LAST,

                    p.id DESC

            `);


        const paiements =
            result.rows.map(
                paiementJSON
            );


        return res.json({

            success:
                true,

            message:
                "Paiements récupérés.",

            data:
                paiements,

            paiements,

            payments:
                paiements,

            total:
                paiements.length

        });

    }

    catch (error) {

        return erreur(

            res,
            500,
            "Impossible de récupérer les paiements.",
            error

        );

    }

}


app.get(
    "/api/paiements",
    recupererPaiements
);

app.get(
    "/api/payments",
    recupererPaiements
);


/* =========================================================
   35. ADMIN PAIEMENTS
========================================================= */

app.get(

    "/api/admin/paiements",

    verifierAdmin,

    recupererPaiements

);


app.get(

    "/api/admin/payments",

    verifierAdmin,

    recupererPaiements

);


/* =========================================================
   36. STATISTIQUES ADMIN
========================================================= */

async function statistiquesAdmin(

    req,
    res

) {

    try {

        const result =
            await pool.query(`

                SELECT

                    (

                        SELECT COUNT(*)

                        FROM utilisateurs

                    ) AS total_utilisateurs,


                    (

                        SELECT COUNT(*)

                        FROM utilisateurs

                        WHERE

                            premium = TRUE

                            OR

                            is_premium = TRUE

                    ) AS total_premium,


                    (

                        SELECT COUNT(*)

                        FROM utilisateurs

                        WHERE bloque = TRUE

                    ) AS total_bloques,


                    (

                        SELECT COUNT(*)

                        FROM utilisateurs

                        WHERE

                            is_admin = TRUE

                            OR

                            LOWER(role) = 'admin'

                    ) AS total_admins,


                    (

                        SELECT COUNT(*)

                        FROM paiements

                        WHERE statut =
                            'en_attente'

                    ) AS total_paiements_attente,


                    (

                        SELECT COUNT(*)

                        FROM paiements

                        WHERE statut =
                            'valide'

                    ) AS total_paiements_valides,


                    (

                        SELECT COUNT(*)

                        FROM paiements

                        WHERE statut =
                            'refuse'

                    ) AS total_paiements_refuses,


                    (

                        SELECT COUNT(*)

                        FROM paiements

                    ) AS total_paiements,


                    (

                        SELECT COALESCE(
                            SUM(montant),
                            0
                        )

                        FROM paiements

                        WHERE statut =
                            'valide'

                    ) AS montant_total_valide

            `);


        const data =
            result.rows[0];


        const statistiques = {

            total_utilisateurs:
                Number(
                    data.total_utilisateurs
                ),

            total_premium:
                Number(
                    data.total_premium
                ),

            total_bloques:
                Number(
                    data.total_bloques
                ),

            total_admins:
                Number(
                    data.total_admins
                ),

            total_paiements_attente:
                Number(
                    data.total_paiements_attente
                ),

            total_paiements_valides:
                Number(
                    data.total_paiements_valides
                ),

            total_paiements_refuses:
                Number(
                    data.total_paiements_refuses
                ),

            total_paiements:
                Number(
                    data.total_paiements
                ),

            montant_total_valide:
                Number(
                    data.montant_total_valide
                )

        };


        return res.json({

            success:
                true,

            message:
                "Statistiques récupérées.",

            data:
                statistiques,

            statistiques,

            stats:
                statistiques

        });

    }

    catch (error) {

        return erreur(

            res,
            500,
            "Impossible de récupérer les statistiques.",
            error

        );

    }

}


app.get(
    "/api/admin/statistiques",
    verifierAdmin,
    statistiquesAdmin
);


/*
   Ancienne route conservée.
*/

app.get(
    "/api/statistiques",
    statistiquesAdmin
);


/* =========================================================
   37. ADMIN DASHBOARD
========================================================= */

app.get(

    "/api/admin/dashboard",

    verifierAdmin,

    async (req, res) => {

        try {

            const [

                utilisateursResult,
                paiementsResult,
                statistiquesResult

            ] = await Promise.all([

                pool.query(`

                    SELECT *

                    FROM utilisateurs

                    ORDER BY id DESC

                `),

                pool.query(`

                    SELECT

                        p.id,

                        p.utilisateur_id,

                        COALESCE(
                            u.nom,
                            p.nom,
                            ''
                        ) AS nom,

                        COALESCE(
                            u.email,
                            p.email,
                            ''
                        ) AS email,

                        COALESCE(
                            u.telephone,
                            p.telephone,
                            ''
                        ) AS telephone,

                        p.montant,

                        p.devise,

                        p.methode,

                        p.numero_operateur,

                        p.statut,

                        p.date_paiement,

                        p.reference,

                        p.preuve,

                        p.origine,

                        p.source,

                        p.ajoute_par_admin,

                        p.added_by_admin,

                        p.note,

                        p.commentaire,

                        p.created_at,

                        p.updated_at

                    FROM paiements p

                    LEFT JOIN utilisateurs u

                        ON u.id =
                           p.utilisateur_id

                    ORDER BY

                        p.date_paiement
                        DESC NULLS LAST,

                        p.id DESC

                `),

                pool.query(`

                    SELECT

                        (

                            SELECT COUNT(*)

                            FROM utilisateurs

                        ) AS total_utilisateurs,


                        (

                            SELECT COUNT(*)

                            FROM utilisateurs

                            WHERE

                                premium = TRUE

                                OR

                                is_premium = TRUE

                        ) AS total_premium,


                        (

                            SELECT COUNT(*)

                            FROM utilisateurs

                            WHERE bloque = TRUE

                        ) AS total_bloques,


                        (

                            SELECT COUNT(*)

                            FROM utilisateurs

                            WHERE

                                is_admin = TRUE

                                OR

                                LOWER(role) = 'admin'

                        ) AS total_admins,


                        (

                            SELECT COUNT(*)

                            FROM paiements

                            WHERE statut =
                                'en_attente'

                        ) AS total_paiements_attente,


                        (

                            SELECT COUNT(*)

                            FROM paiements

                            WHERE statut =
                                'valide'

                        ) AS total_paiements_valides,


                        (

                            SELECT COUNT(*)

                            FROM paiements

                            WHERE statut =
                                'refuse'

                        ) AS total_paiements_refuses,


                        (

                            SELECT COUNT(*)

                            FROM paiements

                        ) AS total_paiements,


                        (

                            SELECT COALESCE(
                                SUM(montant),
                                0
                            )

                            FROM paiements

                            WHERE statut =
                                'valide'

                        ) AS montant_total_valide

                `)

            ]);


            const utilisateurs =
                utilisateursResult.rows.map(
                    utilisateurJSON
                );


            const paiements =
                paiementsResult.rows.map(
                    paiementJSON
                );


            const s =
                statistiquesResult.rows[0];


            const statistiques = {

                total_utilisateurs:
                    Number(
                        s.total_utilisateurs
                    ),

                total_premium:
                    Number(
                        s.total_premium
                    ),

                total_bloques:
                    Number(
                        s.total_bloques
                    ),

                total_admins:
                    Number(
                        s.total_admins
                    ),

                total_paiements_attente:
                    Number(
                        s.total_paiements_attente
                    ),

                total_paiements_valides:
                    Number(
                        s.total_paiements_valides
                    ),

                total_paiements_refuses:
                    Number(
                        s.total_paiements_refuses
                    ),

                total_paiements:
                    Number(
                        s.total_paiements
                    ),

                montant_total_valide:
                    Number(
                        s.montant_total_valide
                    )

            };


            /*
               UNE SEULE REPONSE contenant toutes
               les données nécessaires au dashboard.
            */

            return res.json({

                success:
                    true,

                message:
                    "Dashboard administrateur chargé.",

                admin:
                    req.admin,

                statistiques,

                stats:
                    statistiques,

                utilisateurs,

                users:
                    utilisateurs,

                paiements,

                payments:
                    paiements,

                data: {

                    statistiques,

                    stats:
                        statistiques,

                    utilisateurs,

                    users:
                        utilisateurs,

                    paiements,

                    payments:
                        paiements

                }

            });

        }

        catch (error) {

            return erreur(

                res,
                500,
                "Impossible de charger le dashboard administrateur.",
                error

            );

        }

    }

);


/* =========================================================
   38. CREER PAIEMENT
========================================================= */

async function creerPaiement(

    req,
    res

) {

    try {

        const body =
            req.body || {};


        const rawUserId =
            premier(

                body,

                "utilisateur_id",
                "utilisateurID",
                "user_id",
                "userId",
                "userID"

            );


        let utilisateurId =
            null;


        if (
            rawUserId !== null &&
            rawUserId !== ""
        ) {

            utilisateurId =
                entier(
                    rawUserId
                );


            if (!utilisateurId) {

                return erreur(
                    res,
                    400,
                    "ID utilisateur invalide."
                );

            }


            const user =
                await pool.query(

                    `

                    SELECT id

                    FROM utilisateurs

                    WHERE id = $1

                    `,

                    [utilisateurId]

                );


            if (
                !user.rows.length
            ) {

                return erreur(
                    res,
                    404,
                    "Utilisateur introuvable."
                );

            }

        }


        const montant =
            montantValide(

                premier(
                    body,
                    "montant",
                    "amount",
                    "prix"
                )

            );


        if (montant === null) {

            return erreur(
                res,
                400,
                "Montant de paiement invalide."
            );

        }


        const nom =
            String(

                premier(
                    body,
                    "nom",
                    "name"
                ) || ""

            );


        const email =
            nettoyerEmail(
                body.email
            );


        const telephone =
            String(

                premier(
                    body,
                    "telephone",
                    "phone"
                ) || ""

            );


        const devise =
            String(

                premier(
                    body,
                    "devise",
                    "currency"
                ) || "USD"

            );


        const methode =
            String(

                premier(
                    body,
                    "methode",
                    "method",
                    "mode_paiement",
                    "payment_method"
                ) || ""

            );


        const numero =
            String(

                premier(
                    body,
                    "numero_operateur",
                    "numeroOperateur",
                    "operator_number",
                    "numero"
                ) || ""

            );


        const statut =
            String(

                premier(
                    body,
                    "statut",
                    "status",
                    "etat"
                ) || "en_attente"

            );


        const reference =
            String(

                premier(
                    body,
                    "reference",
                    "transaction_id",
                    "transactionId"
                ) || ""

            );


        const preuve =
            String(

                premier(
                    body,
                    "preuve",
                    "proof",
                    "capture",
                    "image",
                    "preuve_paiement",
                    "capture_paiement"
                ) || ""

            );


        const origine =
            String(
                body.origine || ""
            );


        const source =
            String(
                body.source || ""
            );


        const admin =
            booleanValeur(

                premier(
                    body,
                    "ajoute_par_admin",
                    "added_by_admin"
                )

            );


        const note =
            String(

                premier(
                    body,
                    "note",
                    "commentaire"
                ) || ""

            );


        const dateRaw =
            premier(

                body,

                "date_paiement",
                "date",
                "datePaiement",
                "created_at"

            );


        let datePaiement =
            new Date();


        if (
            dateRaw &&
            !Number.isNaN(
                new Date(
                    dateRaw
                ).getTime()
            )
        ) {

            datePaiement =
                new Date(
                    dateRaw
                );

        }


        const result =
            await pool.query(

                `

                INSERT INTO paiements (

                    utilisateur_id,
                    nom,
                    email,
                    telephone,
                    montant,
                    devise,
                    methode,
                    numero_operateur,
                    statut,
                    date_paiement,
                    reference,
                    preuve,
                    origine,
                    source,
                    ajoute_par_admin,
                    added_by_admin,
                    note,
                    commentaire

                )

                VALUES (

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
                    $12,
                    $13,
                    $14,
                    $15,
                    $16,
                    $17,
                    $18

                )

                RETURNING *

                `,

                [

                    utilisateurId,
                    nom,
                    email,
                    telephone,
                    montant,
                    devise,
                    methode,
                    numero,
                    statut,
                    datePaiement,
                    reference,
                    preuve,
                    origine,
                    source,
                    admin,
                    admin,
                    note,
                    note

                ]

            );


        return succes(

            res,

            paiementJSON(
                result.rows[0]
            ),

            "Paiement enregistré."

        );

    }

    catch (error) {

        return erreur(

            res,
            500,
            "Impossible d'enregistrer le paiement.",
            error

        );

    }

}


app.post(
    "/api/paiements",
    creerPaiement
);

app.post(
    "/api/payments",
    creerPaiement
);

app.post(
    "/api/payment",
    creerPaiement
);


/* =========================================================
   39. GET PAIEMENT ID
========================================================= */

async function recupererPaiement(

    req,
    res

) {

    try {

        const id =
            entier(
                req.params.id
            );


        if (!id) {

            return erreur(
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

                    COALESCE(
                        u.nom,
                        p.nom,
                        ''
                    ) AS nom,

                    COALESCE(
                        u.email,
                        p.email,
                        ''
                    ) AS email,

                    COALESCE(
                        u.telephone,
                        p.telephone,
                        ''
                    ) AS telephone

                FROM paiements p

                LEFT JOIN utilisateurs u

                    ON u.id =
                       p.utilisateur_id

                WHERE p.id = $1

                `,

                [id]

            );


        if (
            !result.rows.length
        ) {

            return erreur(
                res,
                404,
                "Paiement introuvable."
            );

        }


        const paiement =
            paiementJSON(
                result.rows[0]
            );


        return res.json({

            success:
                true,

            message:
                "Paiement récupéré.",

            data:
                paiement,

            paiement,

            payment:
                paiement

        });

    }

    catch (error) {

        return erreur(

            res,
            500,
            "Impossible de récupérer le paiement.",
            error

        );

    }

}


app.get(
    "/api/paiements/:id",
    recupererPaiement
);

app.get(
    "/api/payments/:id",
    recupererPaiement
);

app.get(
    "/api/payment/:id",
    recupererPaiement
);


app.get(

    "/api/admin/paiements/:id",

    verifierAdmin,

    recupererPaiement

);


/* =========================================================
   40. VALIDER PAIEMENT
========================================================= */

app.patch(

    "/api/paiements/:id/valider",

    async (req, res) => {

        const client =
            await pool.connect();


        try {

            const id =
                entier(
                    req.params.id
                );


            if (!id) {

                return erreur(
                    res,
                    400,
                    "ID paiement invalide."
                );

            }


            await client.query(
                "BEGIN"
            );


            const paiement =
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
                !paiement.rows.length
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return erreur(
                    res,
                    404,
                    "Paiement introuvable."
                );

            }


            const p =
                paiement.rows[0];


            await client.query(

                `

                UPDATE paiements

                SET

                    statut = 'valide',

                    updated_at = NOW()

                WHERE id = $1

                `,

                [id]

            );


            if (p.utilisateur_id) {

                await client.query(

                    `

                    UPDATE utilisateurs

                    SET

                        premium = TRUE,

                        is_premium = TRUE,

                        updated_at = NOW()

                    WHERE id = $1

                    `,

                    [p.utilisateur_id]

                );

            }


            const final =
                await client.query(

                    `

                    SELECT *

                    FROM paiements

                    WHERE id = $1

                    `,

                    [id]

                );


            await client.query(
                "COMMIT"
            );


            return succes(

                res,

                paiementJSON(
                    final.rows[0]
                ),

                "Paiement validé et Premium activé."

            );

        }

        catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            }

            catch (_) {}


            return erreur(

                res,
                500,
                "Impossible de valider le paiement.",
                error

            );

        }

        finally {

            client.release();

        }

    }

);


/* =========================================================
   41. ALIAS ADMIN VALIDATION
========================================================= */

app.patch(

    "/api/admin/paiements/:id/valider",

    verifierAdmin,

    async (req, res) => {

        /*
           On réutilise la logique existante
           via une requête interne simplifiée.
        */

        try {

            const id =
                entier(
                    req.params.id
                );


            if (!id) {

                return erreur(
                    res,
                    400,
                    "ID paiement invalide."
                );

            }


            const client =
                await pool.connect();


            try {

                await client.query(
                    "BEGIN"
                );


                const paiement =
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
                    !paiement.rows.length
                ) {

                    await client.query(
                        "ROLLBACK"
                    );

                    return erreur(
                        res,
                        404,
                        "Paiement introuvable."
                    );

                }


                const p =
                    paiement.rows[0];


                await client.query(

                    `

                    UPDATE paiements

                    SET

                        statut = 'valide',

                        updated_at = NOW()

                    WHERE id = $1

                    `,

                    [id]

                );


                if (p.utilisateur_id) {

                    await client.query(

                        `

                        UPDATE utilisateurs

                        SET

                            premium = TRUE,

                            is_premium = TRUE,

                            updated_at = NOW()

                        WHERE id = $1

                        `,

                        [p.utilisateur_id]

                    );

                }


                const final =
                    await client.query(

                        `

                        SELECT *

                        FROM paiements

                        WHERE id = $1

                        `,

                        [id]

                    );


                await client.query(
                    "COMMIT"
                );


                return succes(

                    res,

                    paiementJSON(
                        final.rows[0]
                    ),

                    "Paiement validé et Premium activé."

                );

            }

            catch (error) {

                await client.query(
                    "ROLLBACK"
                );

                throw error;

            }

            finally {

                client.release();

            }

        }

        catch (error) {

            return erreur(

                res,
                500,
                "Impossible de valider le paiement.",
                error

            );

        }

    }

);


/* =========================================================
   42. REFUSER PAIEMENT
========================================================= */

app.patch(

    "/api/paiements/:id/refuser",

    async (req, res) => {

        try {

            const id =
                entier(
                    req.params.id
                );


            if (!id) {

                return erreur(
                    res,
                    400,
                    "ID paiement invalide."
                );

            }


            const note =
                String(

                    req.body?.note ||

                    req.body?.commentaire ||

                    ""

                );


            const result =
                await pool.query(

                    `

                    UPDATE paiements

                    SET

                        statut = 'refuse',

                        note = $1,

                        commentaire = $1,

                        updated_at = NOW()

                    WHERE id = $2

                    RETURNING *

                    `,

                    [
                        note,
                        id
                    ]

                );


            if (
                !result.rows.length
            ) {

                return erreur(
                    res,
                    404,
                    "Paiement introuvable."
                );

            }


            return succes(

                res,

                paiementJSON(
                    result.rows[0]
                ),

                "Paiement refusé."

            );

        }

        catch (error) {

            return erreur(

                res,
                500,
                "Impossible de refuser le paiement.",
                error

            );

        }

    }

);


/* =========================================================
   43. ADMIN REFUS PAIEMENT
========================================================= */

app.patch(

    "/api/admin/paiements/:id/refuser",

    verifierAdmin,

    async (req, res) => {

        try {

            const id =
                entier(
                    req.params.id
                );


            if (!id) {

                return erreur(
                    res,
                    400,
                    "ID paiement invalide."
                );

            }


            const note =
                String(

                    req.body?.note ||

                    req.body?.commentaire ||

                    ""

                );


            const result =
                await pool.query(

                    `

                    UPDATE paiements

                    SET

                        statut = 'refuse',

                        note = $1,

                        commentaire = $1,

                        updated_at = NOW()

                    WHERE id = $2

                    RETURNING *

                    `,

                    [
                        note,
                        id
                    ]

                );


            if (
                !result.rows.length
            ) {

                return erreur(
                    res,
                    404,
                    "Paiement introuvable."
                );

            }


            return succes(

                res,

                paiementJSON(
                    result.rows[0]
                ),

                "Paiement refusé."

            );

        }

        catch (error) {

            return erreur(

                res,
                500,
                "Impossible de refuser le paiement.",
                error

            );

        }

    }

);


/* =========================================================
   44. SUPPRIMER PAIEMENT
========================================================= */

app.delete(

    "/api/paiements/:id",

    async (req, res) => {

        try {

            const id =
                entier(
                    req.params.id
                );


            if (!id) {

                return erreur(
                    res,
                    400,
                    "ID paiement invalide."
                );

            }


            const result =
                await pool.query(

                    `

                    DELETE FROM paiements

                    WHERE id = $1

                    RETURNING *

                    `,

                    [id]

                );


            if (
                !result.rows.length
            ) {

                return erreur(
                    res,
                    404,
                    "Paiement introuvable."
                );

            }


            return succes(

                res,

                paiementJSON(
                    result.rows[0]
                ),

                "Paiement supprimé."

            );

        }

        catch (error) {

            return erreur(

                res,
                500,
                "Impossible de supprimer le paiement.",
                error

            );

        }

    }

);


/* =========================================================
   45. ADMIN SUPPRESSION PAIEMENT
========================================================= */

app.delete(

    "/api/admin/paiements/:id",

    verifierAdmin,

    async (req, res) => {

        try {

            const id =
                entier(
                    req.params.id
                );


            if (!id) {

                return erreur(
                    res,
                    400,
                    "ID paiement invalide."
                );

            }


            const result =
                await pool.query(

                    `

                    DELETE FROM paiements

                    WHERE id = $1

                    RETURNING *

                    `,

                    [id]

                );


            if (
                !result.rows.length
            ) {

                return erreur(
                    res,
                    404,
                    "Paiement introuvable."
                );

            }


            return succes(

                res,

                paiementJSON(
                    result.rows[0]
                ),

                "Paiement supprimé."

            );

        }

        catch (error) {

            return erreur(

                res,
                500,
                "Impossible de supprimer le paiement.",
                error

            );

        }

    }

);


/* =========================================================
   46. 404
========================================================= */

app.use(

    (req, res) => {

        return res.status(404).json({

            success:
                false,

            message:
                "Route API introuvable.",

            route:
                req.originalUrl,

            method:
                req.method,

            routes:
                "/api/routes"

        });

    }

);


/* =========================================================
   47. ERREUR GLOBALE
========================================================= */

app.use(

    (
        errorGlobal,
        req,
        res,
        next
    ) => {

        console.error(
            "ERREUR GLOBALE :",
            errorGlobal
        );


        return res.status(500).json({

            success:
                false,

            message:
                "Erreur interne du serveur.",

            error:
                process.env.NODE_ENV === "production"
                    ? ""
                    : errorGlobal.message

        });

    }

);


/* =========================================================
   48. DEMARRAGE
========================================================= */

async function demarrerServeur() {

    try {

        console.log(
            "=============================================="
        );

        console.log(
            "BMJ SERVICE API"
        );

        console.log(
            "VERSION 10.0.0"
        );

        console.log(
            "Démarrage du serveur..."
        );


        await testerDB();


        console.log(
            "PostgreSQL : CONNEXION OK"
        );


        await initialiserBase();


        await creerAdminDepuisEnv();


        app.listen(

            PORT,

            () => {

                console.log(
                    "=============================================="
                );

                console.log(
                    `BMJ SERVICE : PORT ${PORT}`
                );

                console.log(
                    "PostgreSQL : CONNECTÉ"
                );

                console.log(
                    "API : /api"
                );

                console.log(
                    "Routes : /api/routes"
                );

                console.log(
                    "Inscription : /api/inscription"
                );

                console.log(
                    "Connexion : /api/connexion"
                );

                console.log(
                    "ADMIN : /api/admin/connexion"
                );

                console.log(
                    "ADMIN DASHBOARD : /api/admin/dashboard"
                );

                console.log(
                    "Utilisateurs : /api/utilisateurs"
                );

                console.log(
                    "Paiements : /api/paiements"
                );

                console.log(
                    "=============================================="
                );

            }

        );

    }

    catch (error) {

        console.error(
            "=============================================="
        );

        console.error(
            "ERREUR DE DEMARRAGE BMJ SERVICE"
        );

        console.error(
            error
        );

        console.error(
            "=============================================="
        );

        process.exit(
            1
        );

    }

}


/* =========================================================
   49. ARRET PROPRE
========================================================= */

async function arretPropre() {

    console.log(
        "Arrêt de BMJ SERVICE..."
    );


    try {

        await pool.end();

    }

    catch (error) {

        console.error(
            error.message
        );

    }


    process.exit(
        0
    );

}


process.on(
    "SIGTERM",
    arretPropre
);

process.on(
    "SIGINT",
    arretPropre
);


/* =========================================================
   50. LANCEMENT
========================================================= */

demarrerServeur();