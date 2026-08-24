/* =========================================================
   BMJ SERVICE
   BACKEND API COMPLET
   NODE.JS + EXPRESS + POSTGRESQL
   RENDER

   VERSION : 9.0.0

   =========================================================
   FONCTIONNALITES
   ---------------------------------------------------------
   - PostgreSQL
   - Creation automatique des tables
   - Migration des colonnes manquantes
   - Inscription
   - Connexion
   - Plusieurs alias de connexion
   - Gestion utilisateurs
   - Gestion utilisateurs Premium
   - Blocage utilisateur
   - Suppression utilisateur
   - Gestion paiements
   - Validation paiement
   - Activation Premium
   - Refus paiement
   - Suppression paiement
   - Statistiques administration
   - Health check
   - Compatibilite anciens noms de champs
   - Compatibilite anciennes routes
   - CORS
   - Logs
========================================================= */

"use strict";


/* =========================================================
   1. IMPORTS
========================================================= */

const express = require("express");
const cors = require("cors");
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
   4. MIDDLEWARES
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
   5. LOGS
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
   6. OUTILS
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

        data

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
        error?.message || error || ""
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
   7. NORMALISATION UTILISATEUR
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
            bloque

    };

}


/* =========================================================
   8. NORMALISATION PAIEMENT
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
   9. TEST DATABASE
========================================================= */

async function testerDB() {

    const result =
        await pool.query(
            "SELECT NOW() AS maintenant"
        );

    return result.rows[0];

}


/* =========================================================
   10. CREATION TABLE UTILISATEURS
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

            created_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW(),

            updated_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW()

        )

    `);

}


/* =========================================================
   11. CREATION TABLE PAIEMENTS
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
   12. COLONNES MANQUANTES
========================================================= */

async function ajouterColonnesManquantes() {


    const utilisateurs = [

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
            "created_at",
            "TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        ],

        [
            "updated_at",
            "TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        ]

    ];


    for (
        const [nom, type] of utilisateurs
    ) {

        await pool.query(`

            ALTER TABLE utilisateurs

            ADD COLUMN IF NOT EXISTS
            ${nom}
            ${type}

        `);

    }


    const paiements = [

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
        const [nom, type] of paiements
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
   13. INDEX
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
   14. INITIALISATION
========================================================= */

async function initialiserBase() {

    console.log(
        "Initialisation PostgreSQL..."
    );


    await creerTableUtilisateurs();

    await creerTablePaiements();

    await ajouterColonnesManquantes();

    await creerIndexes();


    console.log(
        "PostgreSQL : tables et index prêts."
    );

}


/* =========================================================
   15. RACINE
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
                "9.0.0",

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
   16. API
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
                "9.0.0",

            routes:
                "/api/routes"

        });

    }

);


/* =========================================================
   17. ROUTES DISPONIBLES
========================================================= */

app.get(

    "/api/routes",

    (req, res) => {

        return res.json({

            success:
                true,

            version:
                "9.0.0",

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


                /* =============================================
                   AUTHENTIFICATION
                ============================================= */

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


                /* =============================================
                   UTILISATEURS
                ============================================= */

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


                /* =============================================
                   ALIAS USERS
                ============================================= */

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


                /* =============================================
                   AUTRES ALIAS UTILISATEUR
                ============================================= */

                {
                    method: "GET",
                    path: "/api/user/:id"
                },

                {
                    method: "GET",
                    path: "/api/utilisateur/:id"
                },


                /* =============================================
                   PAIEMENTS
                ============================================= */

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


                /* =============================================
                   ALIAS PAYMENTS
                ============================================= */

                {
                    method: "GET",
                    path: "/api/payments"
                },

                {
                    method: "GET",
                    path: "/api/payment/:id"
                },


                /* =============================================
                   ADMIN
                ============================================= */

                {
                    method: "GET",
                    path: "/api/admin/statistiques"
                },

                {
                    method: "GET",
                    path: "/api/statistiques"
                }

            ]

        });

    }

);


/* =========================================================
   18. HEALTH
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
                    "9.0.0",

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
   19. TEST DB
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
   20. INSCRIPTION
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


        /* ---------------------------------------------
           VERIFICATION EMAIL
        --------------------------------------------- */

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


        /* ---------------------------------------------
           CREATION
        --------------------------------------------- */

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
                    bloque

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
                    FALSE

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


/* =========================================================
   21. ROUTES INSCRIPTION
========================================================= */

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
   22. CONNEXION
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


/* =========================================================
   23. ROUTES CONNEXION
========================================================= */

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
   24. GET UTILISATEURS
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


        return succes(

            res,

            result.rows.map(
                utilisateurJSON
            ),

            "Utilisateurs récupérés."

        );

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
   25. GET UTILISATEUR PAR ID
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


        if (!result.rows.length) {

            return erreur(

                res,
                404,
                "Utilisateur introuvable."

            );

        }


        return succes(

            res,

            utilisateurJSON(
                result.rows[0]
            ),

            "Utilisateur récupéré."

        );

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
   26. CREER UTILISATEUR
========================================================= */

app.post(

    "/api/utilisateurs",

    async (req, res) => {

        try {

            const body =
                req.body || {};


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


            const motDePasse =
                String(
                    premier(
                        body,
                        "mot_de_passe",
                        "motDePasse",
                        "password"
                    ) || ""
                );


            const domaine =
                String(
                    premier(
                        body,
                        "domaine",
                        "domain"
                    ) || ""
                );


            const photo =
                String(
                    premier(
                        body,
                        "photo",
                        "image"
                    ) || ""
                );


            const premium =
                booleanValeur(
                    premier(
                        body,
                        "premium",
                        "is_premium",
                        "isPremium"
                    )
                );


            const bloque =
                booleanValeur(
                    premier(
                        body,
                        "bloque",
                        "blocked"
                    )
                );


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
                        bloque

                    )

                    VALUES (

                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $7,
                        $8

                    )

                    RETURNING *

                    `,

                    [

                        nom,
                        email,
                        telephone,
                        motDePasse,
                        domaine,
                        photo,
                        premium,
                        bloque

                    ]

                );


            return succes(

                res,

                utilisateurJSON(
                    result.rows[0]
                ),

                "Utilisateur créé."

            );

        }

        catch (error) {

            return erreur(

                res,
                500,
                "Impossible de créer l'utilisateur.",
                error

            );

        }

    }

);


/* =========================================================
   27. ALIAS CREATION USERS
========================================================= */

app.post(

    "/api/users",

    async (req, res) => {

        req.url =
            "/api/utilisateurs";

        return res.redirect(

            307,
            "/api/utilisateurs"

        );

    }

);


/* =========================================================
   28. MODIFIER UTILISATEUR
========================================================= */

async function modifierUtilisateur(
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


        const body =
            req.body || {};


        const champs = [];

        const valeurs = [];


        function ajouter(
            colonne,
            valeur
        ) {

            champs.push(
                `${colonne} = $${valeurs.length + 1}`
            );

            valeurs.push(
                valeur
            );

        }


        if (
            body.nom !== undefined ||
            body.name !== undefined
        ) {

            ajouter(

                "nom",

                String(
                    premier(
                        body,
                        "nom",
                        "name"
                    ) || ""
                )

            );

        }


        if (
            body.email !== undefined
        ) {

            ajouter(

                "email",

                nettoyerEmail(
                    body.email
                )

            );

        }


        if (
            body.telephone !== undefined ||
            body.phone !== undefined
        ) {

            ajouter(

                "telephone",

                String(
                    premier(
                        body,
                        "telephone",
                        "phone"
                    ) || ""
                )

            );

        }


        if (
            body.mot_de_passe !== undefined ||
            body.motDePasse !== undefined ||
            body.password !== undefined
        ) {

            ajouter(

                "mot_de_passe",

                String(
                    premier(
                        body,
                        "mot_de_passe",
                        "motDePasse",
                        "password"
                    ) || ""
                )

            );

        }


        if (
            body.domaine !== undefined
        ) {

            ajouter(

                "domaine",

                String(
                    body.domaine || ""
                )

            );

        }


        if (
            body.photo !== undefined
        ) {

            ajouter(

                "photo",

                String(
                    body.photo || ""
                )

            );

        }


        if (
            body.premium !== undefined ||
            body.is_premium !== undefined ||
            body.isPremium !== undefined
        ) {

            const premium =
                booleanValeur(
                    premier(
                        body,
                        "premium",
                        "is_premium",
                        "isPremium"
                    )
                );


            ajouter(
                "premium",
                premium
            );


            ajouter(
                "is_premium",
                premium
            );

        }


        if (
            body.bloque !== undefined ||
            body.blocked !== undefined
        ) {

            ajouter(

                "bloque",

                booleanValeur(
                    premier(
                        body,
                        "bloque",
                        "blocked"
                    )
                )

            );

        }


        if (!champs.length) {

            return erreur(

                res,
                400,
                "Aucune modification fournie."

            );

        }


        champs.push(
            "updated_at = NOW()"
        );


        valeurs.push(
            id
        );


        const result =
            await pool.query(

                `

                UPDATE utilisateurs

                SET
                    ${champs.join(", ")}

                WHERE id = $${valeurs.length}

                RETURNING *

                `,

                valeurs

            );


        if (!result.rows.length) {

            return erreur(

                res,
                404,
                "Utilisateur introuvable."

            );

        }


        return succes(

            res,

            utilisateurJSON(
                result.rows[0]
            ),

            "Utilisateur modifié."

        );

    }

    catch (error) {

        return erreur(

            res,
            500,
            "Impossible de modifier l'utilisateur.",
            error

        );

    }

}


app.put(
    "/api/utilisateurs/:id",
    modifierUtilisateur
);

app.patch(
    "/api/utilisateurs/:id",
    modifierUtilisateur
);


/* =========================================================
   29. SUPPRIMER UTILISATEUR
========================================================= */

app.delete(

    "/api/utilisateurs/:id",

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
                    "ID utilisateur invalide."
                );

            }


            const result =
                await pool.query(

                    `

                    DELETE FROM utilisateurs

                    WHERE id = $1

                    RETURNING *

                    `,

                    [id]

                );


            if (!result.rows.length) {

                return erreur(

                    res,
                    404,
                    "Utilisateur introuvable."

                );

            }


            return succes(

                res,

                utilisateurJSON(
                    result.rows[0]
                ),

                "Utilisateur supprimé."

            );

        }

        catch (error) {

            return erreur(

                res,
                500,
                "Impossible de supprimer l'utilisateur.",
                error

            );

        }

    }

);


/* =========================================================
   30. GET PAIEMENTS
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


        return succes(

            res,

            result.rows.map(
                paiementJSON
            ),

            "Paiements récupérés."

        );

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
   31. GET PAIEMENT
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


        if (!result.rows.length) {

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

            "Paiement récupéré."

        );

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


/* =========================================================
   32. CREER PAIEMENT
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


            if (!user.rows.length) {

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
   33. MODIFIER PAIEMENT
========================================================= */

async function modifierPaiement(
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


        const body =
            req.body || {};


        const champs = [];

        const valeurs = [];


        function ajouter(
            colonne,
            valeur
        ) {

            champs.push(
                `${colonne} = $${valeurs.length + 1}`
            );

            valeurs.push(
                valeur
            );

        }


        const statut =
            premier(
                body,
                "statut",
                "status",
                "etat"
            );


        if (statut !== null) {

            ajouter(
                "statut",
                String(statut)
            );

        }


        const reference =
            premier(
                body,
                "reference",
                "transaction_id",
                "transactionId"
            );


        if (reference !== null) {

            ajouter(
                "reference",
                String(reference || "")
            );

        }


        const preuve =
            premier(
                body,
                "preuve",
                "proof",
                "capture",
                "image",
                "preuve_paiement",
                "capture_paiement"
            );


        if (preuve !== null) {

            ajouter(
                "preuve",
                String(preuve || "")
            );

        }


        const note =
            premier(
                body,
                "note",
                "commentaire"
            );


        if (note !== null) {

            ajouter(
                "note",
                String(note || "")
            );

            ajouter(
                "commentaire",
                String(note || "")
            );

        }


        if (!champs.length) {

            return erreur(

                res,
                400,
                "Aucune modification fournie."

            );

        }


        champs.push(
            "updated_at = NOW()"
        );


        valeurs.push(
            id
        );


        const result =
            await pool.query(

                `

                UPDATE paiements

                SET
                    ${champs.join(", ")}

                WHERE id = $${valeurs.length}

                RETURNING *

                `,

                valeurs

            );


        if (!result.rows.length) {

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

            "Paiement modifié."

        );

    }

    catch (error) {

        return erreur(

            res,
            500,
            "Impossible de modifier le paiement.",
            error

        );

    }

}


app.put(
    "/api/paiements/:id",
    modifierPaiement
);

app.patch(
    "/api/paiements/:id",
    modifierPaiement
);


/* =========================================================
   34. VALIDER PAIEMENT
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


            if (!paiement.rows.length) {

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
   35. REFUSER PAIEMENT
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


            if (!result.rows.length) {

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
   36. SUPPRIMER PAIEMENT
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


            if (!result.rows.length) {

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
   37. STATISTIQUES ADMIN
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


        return succes(

            res,

            {

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

            },

            "Statistiques récupérées."

        );

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
    statistiquesAdmin
);

app.get(
    "/api/statistiques",
    statistiquesAdmin
);


/* =========================================================
   38. 404
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
   39. ERREUR GLOBALE
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
   40. DEMARRAGE
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
            "VERSION 9.0.0"
        );

        console.log(
            "Démarrage du serveur..."
        );


        await testerDB();


        console.log(
            "PostgreSQL : CONNEXION OK"
        );


        await initialiserBase();


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
   41. ARRET PROPRE
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
   42. LANCEMENT
========================================================= */

demarrerServeur();