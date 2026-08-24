/* =========================================================
   BMJ SERVICE
   BACKEND API COMPLET
   NODE.JS + EXPRESS + POSTGRESQL
   RENDER

   VERSION : 7.0.0

   COMPATIBLE AVEC :
   ---------------------------------------------------------
   ADMIN BMJ SERVICE
   UTILISATEURS
   APPRENANTS
   INSCRIPTION
   CONNEXION
   PAIEMENTS
   PREUVES DE PAIEMENT
   PREMIUM
   BLOCAGE
   VALIDATION
   REFUS
   SUPPRESSION
   STATISTIQUES
   AUTO REFRESH ADMIN

   URL RENDER :
   https://back-end-h602.onrender.com
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

const PORT = process.env.PORT || 10000;

/* =========================================================
   3. CONFIGURATION POSTGRESQL
========================================================= */

/*
   RECOMMANDÉ SUR RENDER :

   Dans Render :
   Environment
   -> DATABASE_URL
   -> colle ton Internal Database URL PostgreSQL

   Le serveur utilisera automatiquement cette valeur.
*/

const DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://bmj_db_user:5FSX8YeJNzwinKdFOrIeEC43aQsuzf91@dpg-d9sdlt49v7es73emrq8g-a/bmj_db";


/*
   Si tu veux temporairement mettre l'URL directement
   dans le fichier, remplace "" ci-dessus par ton URL.
*/

if (!DATABASE_URL) {

    console.error(
        "ERREUR : DATABASE_URL PostgreSQL n'est pas configurée."
    );

}


/* =========================================================
   4. POOL POSTGRESQL
========================================================= */

const pool = new Pool({

    connectionString: DATABASE_URL,

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
    (error) => {

        console.error(
            "POSTGRESQL POOL ERROR :",
            error.message
        );

    }
);


/* =========================================================
   5. CORS
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


/* =========================================================
   6. BODY PARSER
========================================================= */

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


/* =========================================================
   7. LOG DES REQUÊTES
========================================================= */

app.use(

    (req, res, next) => {

        const debut = Date.now();

        res.on(
            "finish",
            () => {

                const duree =
                    Date.now() - debut;

                console.log(
                    `[API] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duree}ms)`
                );

            }
        );

        next();

    }

);


/* =========================================================
   8. OUTILS
========================================================= */

function success(
    res,
    data = null,
    message = "Opération réussie."
) {

    return res.json({

        success: true,

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
        "[API ERROR]",
        message,
        error?.message || ""
    );

    return res.status(status).json({

        success: false,

        message,

        error:
            process.env.NODE_ENV === "production"
                ? ""
                : error?.message || ""

    });

}


function bool(value) {

    return (
        value === true ||
        value === "true" ||
        value === 1 ||
        value === "1"
    );

}


function first(
    object,
    ...keys
) {

    for (const key of keys) {

        if (
            object &&
            object[key] !== undefined &&
            object[key] !== null
        ) {

            return object[key];

        }

    }

    return null;

}


function idValide(value) {

    const id = Number(value);

    return Number.isInteger(id)
        ? id
        : null;

}


/* =========================================================
   9. FORMAT UTILISATEUR
========================================================= */

function formatUtilisateur(row) {

    if (!row) {
        return null;
    }

    const premium =
        bool(row.premium) ||
        bool(row.is_premium);

    const bloque =
        bool(row.bloque) ||
        bool(row.blocked);

    return {

        ...row,

        id: row.id,

        utilisateurID: row.id,

        utilisateur_id: row.id,

        user_id: row.id,

        userId: row.id,

        userID: row.id,

        nom: row.nom || "",

        name: row.nom || "",

        email: row.email || "",

        telephone: row.telephone || "",

        phone: row.telephone || "",

        domaine: row.domaine || "",

        photo: row.photo || "",

        premium,

        is_premium: premium,

        isPremium: premium,

        bloque,

        blocked: bloque

    };

}


/* =========================================================
   10. FORMAT PAIEMENT
========================================================= */

function formatPaiement(row) {

    if (!row) {
        return null;
    }

    return {

        ...row,

        id: row.id,

        paiement_id: row.id,

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
            row.nom ||
            row.utilisateur_nom ||
            "",

        name:
            row.nom ||
            row.utilisateur_nom ||
            "",

        email:
            row.email ||
            row.utilisateur_email ||
            "",

        telephone:
            row.telephone ||
            row.utilisateur_telephone ||
            "",

        phone:
            row.telephone ||
            row.utilisateur_telephone ||
            "",

        montant:
            Number(row.montant || 0),

        amount:
            Number(row.montant || 0),

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

        numeroOperateur:
            row.numero_operateur || "",

        numero_operateur:
            row.numero_operateur || "",

        operator_number:
            row.numero_operateur || "",

        statut:
            row.statut || "en_attente",

        status:
            row.statut || "en_attente",

        etat:
            row.statut || "en_attente",

        reference:
            row.reference || "",

        transaction_id:
            row.reference || "",

        transactionId:
            row.reference || "",

        preuve:
            row.preuve || "",

        capture:
            row.preuve || "",

        proof:
            row.preuve || "",

        image:
            row.preuve || "",

        preuve_paiement:
            row.preuve || "",

        capture_paiement:
            row.preuve || "",

        note:
            row.note || "",

        commentaire:
            row.commentaire ||
            row.note ||
            "",

        date:
            row.date_paiement ||
            row.created_at,

        date_paiement:
            row.date_paiement,

        datePaiement:
            row.date_paiement

    };

}


/* =========================================================
   11. INITIALISATION DES TABLES
========================================================= */

async function initialiserBase() {

    console.log(
        "Initialisation de la base PostgreSQL..."
    );


    /* =====================================================
       TABLE UTILISATEURS
    ===================================================== */

    await pool.query(`

        CREATE TABLE IF NOT EXISTS utilisateurs (

            id SERIAL PRIMARY KEY,

            nom TEXT NOT NULL DEFAULT '',

            email TEXT NOT NULL DEFAULT '',

            telephone TEXT NOT NULL DEFAULT '',

            mot_de_passe TEXT NOT NULL DEFAULT '',

            domaine TEXT NOT NULL DEFAULT '',

            photo TEXT NOT NULL DEFAULT '',

            premium BOOLEAN NOT NULL DEFAULT FALSE,

            is_premium BOOLEAN NOT NULL DEFAULT FALSE,

            bloque BOOLEAN NOT NULL DEFAULT FALSE,

            created_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW(),

            updated_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW()

        );

    `);


    /* =====================================================
       TABLE PAIEMENTS
    ===================================================== */

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

        );

    `);


    /* =====================================================
       TABLE ADMINS
    ===================================================== */

    await pool.query(`

        CREATE TABLE IF NOT EXISTS admins (

            id SERIAL PRIMARY KEY,

            nom TEXT NOT NULL DEFAULT '',

            email TEXT NOT NULL DEFAULT '',

            mot_de_passe TEXT NOT NULL DEFAULT '',

            actif BOOLEAN NOT NULL DEFAULT TRUE,

            created_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW()

        );

    `);


    /* =====================================================
       INDEX
    ===================================================== */

    await pool.query(`

        CREATE INDEX IF NOT EXISTS
        idx_utilisateurs_email
        ON utilisateurs(email);

    `);


    await pool.query(`

        CREATE INDEX IF NOT EXISTS
        idx_utilisateurs_premium
        ON utilisateurs(premium);

    `);


    await pool.query(`

        CREATE INDEX IF NOT EXISTS
        idx_utilisateurs_bloque
        ON utilisateurs(bloque);

    `);


    await pool.query(`

        CREATE INDEX IF NOT EXISTS
        idx_paiements_utilisateur
        ON paiements(utilisateur_id);

    `);


    await pool.query(`

        CREATE INDEX IF NOT EXISTS
        idx_paiements_statut
        ON paiements(statut);

    `);


    await pool.query(`

        CREATE INDEX IF NOT EXISTS
        idx_paiements_date
        ON paiements(date_paiement DESC);

    `);


    console.log(
        "Tables PostgreSQL prêtes."
    );

}


/* =========================================================
   12. ROUTE RACINE
========================================================= */

app.get(
    "/",
    async (req, res) => {

        let database = "offline";

        try {

            await pool.query(
                "SELECT 1"
            );

            database = "online";

        }
        catch (error) {

            console.error(
                "ROOT DB:",
                error.message
            );

        }

        return res.json({

            success: true,

            message:
                "BMJ SERVICE API fonctionne.",

            version:
                "7.0.0",

            database,

            api:
                "/api",

            server:
                "Render",

            routes:
                "/api/routes"

        });

    }
);


/* =========================================================
   13. TEST DATABASE
========================================================= */

app.get(
    "/api/test-db",
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    "SELECT NOW() AS maintenant"
                );

            return res.json({

                success: true,

                message:
                    "Connexion PostgreSQL réussie.",

                database:
                    "PostgreSQL",

                time:
                    result.rows[0].maintenant

            });

        }
        catch (error) {

            return erreur(

                res,
                500,
                "Erreur connexion PostgreSQL.",
                error

            );

        }

    }
);


/* =========================================================
   14. HEALTH
========================================================= */

app.get(
    "/api/health",
    async (req, res) => {

        try {

            await pool.query(
                "SELECT 1"
            );

            return res.json({

                success: true,

                status: "online",

                database: "online",

                timestamp:
                    new Date().toISOString()

            });

        }
        catch (error) {

            return res.status(503).json({

                success: false,

                status: "offline",

                database: "offline",

                timestamp:
                    new Date().toISOString()

            });

        }

    }
);


/* =========================================================
   15. LISTE DES ROUTES
========================================================= */

app.get(
    "/api/routes",
    (req, res) => {

        return res.json({

            success: true,

            message:
                "Routes BMJ SERVICE disponibles.",

            routes: [

                "GET /",

                "GET /api",

                "GET /api/routes",

                "GET /api/test-db",

                "GET /api/health",

                "GET /api/utilisateurs",

                "GET /api/users",

                "GET /api/apprenants",

                "POST /api/utilisateurs",

                "POST /api/users",

                "POST /api/apprenants",

                "GET /api/utilisateurs/:id",

                "GET /api/apprenants/:id",

                "PUT /api/utilisateurs/:id",

                "PATCH /api/utilisateurs/:id",

                "PUT /api/apprenants/:id",

                "PATCH /api/apprenants/:id",

                "DELETE /api/utilisateurs/:id",

                "DELETE /api/apprenants/:id",

                "POST /api/inscription",

                "POST /api/connexion",

                "GET /api/paiements",

                "GET /api/payments",

                "GET /api/paiements/:id",

                "POST /api/paiements",

                "POST /api/payments",

                "PUT /api/paiements/:id",

                "PATCH /api/paiements/:id",

                "PATCH /api/paiements/:id/valider",

                "PATCH /api/paiements/:id/refuser",

                "DELETE /api/paiements/:id",

                "GET /api/admin/statistiques",

                "GET /api/admin/dashboard",

                "GET /api/admin",

                "GET /api/stats"

            ]

        });

    }
);


/* =========================================================
   16. GET UTILISATEURS
========================================================= */

async function obtenirUtilisateurs(req, res) {

    try {

        const result =
            await pool.query(`

                SELECT *

                FROM utilisateurs

                ORDER BY id DESC

            `);

        const data =
            result.rows.map(
                formatUtilisateur
            );

        return success(
            res,
            data,
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
    obtenirUtilisateurs
);


app.get(
    "/api/users",
    obtenirUtilisateurs
);


app.get(
    "/api/apprenants",
    obtenirUtilisateurs
);


/* =========================================================
   17. UTILISATEUR PAR ID
========================================================= */

async function obtenirUtilisateur(req, res) {

    try {

        const id =
            idValide(
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

        return success(

            res,

            formatUtilisateur(
                result.rows[0]
            )

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
    obtenirUtilisateur
);


app.get(
    "/api/users/:id",
    obtenirUtilisateur
);


app.get(
    "/api/apprenants/:id",
    obtenirUtilisateur
);


/* =========================================================
   18. INSCRIPTION
========================================================= */

async function creerUtilisateur(req, res) {

    try {

        const body =
            req.body || {};

        const nom =
            String(
                first(
                    body,
                    "nom",
                    "name"
                ) || ""
            );

        const email =
            String(
                first(
                    body,
                    "email"
                ) || ""
            );

        const telephone =
            String(
                first(
                    body,
                    "telephone",
                    "phone"
                ) || ""
            );

        const motDePasse =
            String(
                first(
                    body,
                    "mot_de_passe",
                    "password",
                    "motDePasse"
                ) || ""
            );

        const domaine =
            String(
                first(
                    body,
                    "domaine",
                    "domain"
                ) || ""
            );

        const photo =
            String(
                first(
                    body,
                    "photo",
                    "image"
                ) || ""
            );

        const premium =
            bool(
                first(
                    body,
                    "premium",
                    "is_premium",
                    "isPremium"
                )
            );

        const bloque =
            bool(
                first(
                    body,
                    "bloque",
                    "blocked"
                )
            );


        /*
           Vérification email existant
        */

        if (email) {

            const exist =
                await pool.query(

                    `

                    SELECT id

                    FROM utilisateurs

                    WHERE LOWER(email) = LOWER($1)

                    LIMIT 1

                    `,

                    [email]

                );

            if (exist.rows.length) {

                return erreur(
                    res,
                    409,
                    "Cette adresse email existe déjà."
                );

            }

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


        return success(

            res,

            formatUtilisateur(
                result.rows[0]
            ),

            "Utilisateur créé avec succès."

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


app.post(
    "/api/utilisateurs",
    creerUtilisateur
);


app.post(
    "/api/users",
    creerUtilisateur
);


app.post(
    "/api/apprenants",
    creerUtilisateur
);


app.post(
    "/api/inscription",
    creerUtilisateur
);


/* =========================================================
   19. CONNEXION
========================================================= */

app.post(
    "/api/connexion",
    async (req, res) => {

        try {

            const body =
                req.body || {};

            const email =
                String(
                    body.email || ""
                ).trim();

            const password =
                String(
                    first(
                        body,
                        "password",
                        "mot_de_passe",
                        "motDePasse"
                    ) || ""
                );


            if (!email || !password) {

                return erreur(
                    res,
                    400,
                    "Email et mot de passe obligatoires."
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


            if (!result.rows.length) {

                return erreur(
                    res,
                    401,
                    "Email ou mot de passe incorrect."
                );

            }


            const user =
                result.rows[0];


            if (
                user.mot_de_passe !==
                password
            ) {

                return erreur(
                    res,
                    401,
                    "Email ou mot de passe incorrect."
                );

            }


            if (bool(user.bloque)) {

                return erreur(
                    res,
                    403,
                    "Ce compte est bloqué."
                );

            }


            return success(

                res,

                formatUtilisateur(
                    user
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
);


/* =========================================================
   20. MODIFICATION UTILISATEUR
========================================================= */

async function modifierUtilisateur(req, res) {

    try {

        const id =
            idValide(
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
                    first(
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
                String(
                    body.email || ""
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
                    first(
                        body,
                        "telephone",
                        "phone"
                    ) || ""
                )
            );

        }


        if (
            body.mot_de_passe !== undefined ||
            body.password !== undefined
        ) {

            ajouter(
                "mot_de_passe",
                String(
                    first(
                        body,
                        "mot_de_passe",
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
                bool(
                    first(
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

                bool(
                    first(
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


        return success(

            res,

            formatUtilisateur(
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


app.put(
    "/api/users/:id",
    modifierUtilisateur
);


app.patch(
    "/api/users/:id",
    modifierUtilisateur
);


app.put(
    "/api/apprenants/:id",
    modifierUtilisateur
);


app.patch(
    "/api/apprenants/:id",
    modifierUtilisateur
);


/* =========================================================
   21. SUPPRESSION UTILISATEUR
========================================================= */

async function supprimerUtilisateur(req, res) {

    try {

        const id =
            idValide(
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


        return success(

            res,

            formatUtilisateur(
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


app.delete(
    "/api/utilisateurs/:id",
    supprimerUtilisateur
);


app.delete(
    "/api/users/:id",
    supprimerUtilisateur
);


app.delete(
    "/api/apprenants/:id",
    supprimerUtilisateur
);


/* =========================================================
   22. GET PAIEMENTS
========================================================= */

async function obtenirPaiements(req, res) {

    try {

        const result =
            await pool.query(`

                SELECT

                    p.*,

                    COALESCE(
                        u.nom,
                        p.nom,
                        ''
                    ) AS utilisateur_nom,

                    COALESCE(
                        u.email,
                        p.email,
                        ''
                    ) AS utilisateur_email,

                    COALESCE(
                        u.telephone,
                        p.telephone,
                        ''
                    ) AS utilisateur_telephone

                FROM paiements p

                LEFT JOIN utilisateurs u

                    ON u.id =
                       p.utilisateur_id

                ORDER BY

                    p.date_paiement
                    DESC NULLS LAST,

                    p.id DESC

            `);


        const data =
            result.rows.map(
                formatPaiement
            );


        return success(

            res,

            data,

            "Paiements récupérés."

        );

    }
    catch (error) {

        console.error(
            "ERREUR GET PAIEMENTS :",
            error
        );

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
    obtenirPaiements
);


app.get(
    "/api/payments",
    obtenirPaiements
);


/* =========================================================
   23. PAIEMENT PAR ID
========================================================= */

async function obtenirPaiement(req, res) {

    try {

        const id =
            idValide(
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

                    u.nom AS utilisateur_nom,

                    u.email AS utilisateur_email,

                    u.telephone
                        AS utilisateur_telephone

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


        return success(

            res,

            formatPaiement(
                result.rows[0]
            )

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
    obtenirPaiement
);


app.get(
    "/api/payments/:id",
    obtenirPaiement
);


/* =========================================================
   24. CREER PAIEMENT
========================================================= */

async function creerPaiement(req, res) {

    try {

        const body =
            req.body || {};


        const utilisateurId =
            first(
                body,
                "utilisateurID",
                "utilisateur_id",
                "user_id",
                "userId",
                "userID"
            );


        let userId = null;


        if (
            utilisateurId !== null &&
            utilisateurId !== ""
        ) {

            userId =
                idValide(
                    utilisateurId
                );

            if (!userId) {

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

                    [userId]

                );


            if (!user.rows.length) {

                return erreur(
                    res,
                    404,
                    "Utilisateur introuvable."
                );

            }

        }


        const nom =
            String(
                first(
                    body,
                    "nom",
                    "name"
                ) || ""
            );


        const email =
            String(
                body.email || ""
            );


        const telephone =
            String(
                first(
                    body,
                    "telephone",
                    "phone"
                ) || ""
            );


        const montant =
            Number(
                first(
                    body,
                    "montant",
                    "amount",
                    "prix"
                )
            );


        if (
            !Number.isFinite(montant) ||
            montant <= 0
        ) {

            return erreur(
                res,
                400,
                "Montant de paiement invalide."
            );

        }


        const devise =
            String(
                first(
                    body,
                    "devise",
                    "currency"
                ) || "USD"
            );


        const methode =
            String(
                first(
                    body,
                    "methode",
                    "method",
                    "payment_method"
                ) || ""
            );


        const numero =
            String(
                first(
                    body,
                    "numeroOperateur",
                    "numero_operateur",
                    "operator_number",
                    "numero"
                ) || ""
            );


        const statut =
            String(
                first(
                    body,
                    "statut",
                    "status",
                    "etat"
                ) || "en_attente"
            );


        const reference =
            String(
                first(
                    body,
                    "reference",
                    "transaction_id",
                    "transactionId"
                ) || ""
            );


        const preuve =
            String(
                first(
                    body,
                    "preuve",
                    "capture",
                    "proof",
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
            bool(
                first(
                    body,
                    "ajoute_par_admin",
                    "added_by_admin"
                )
            );


        const note =
            String(
                first(
                    body,
                    "note",
                    "commentaire"
                ) || ""
            );


        const date =
            first(
                body,
                "date",
                "date_paiement",
                "datePaiement"
            );


        let datePaiement =
            new Date();


        if (
            date &&
            !Number.isNaN(
                new Date(date).getTime()
            )
        ) {

            datePaiement =
                new Date(date);

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
                    $15,
                    $16,
                    $16

                )

                RETURNING *

                `,

                [

                    userId,

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

                    note

                ]

            );


        return success(

            res,

            formatPaiement(
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


/* =========================================================
   25. MODIFIER PAIEMENT
========================================================= */

async function modifierPaiement(req, res) {

    try {

        const id =
            idValide(
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
            first(
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
            first(
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
            first(
                body,
                "preuve",
                "capture",
                "proof",
                "image",
                "preuve_paiement"
            );

        if (preuve !== null) {

            ajouter(
                "preuve",
                String(preuve || "")
            );

        }


        const note =
            first(
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


        return success(

            res,

            formatPaiement(
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


app.put(
    "/api/payments/:id",
    modifierPaiement
);


app.patch(
    "/api/payments/:id",
    modifierPaiement
);


/* =========================================================
   26. VALIDER PAIEMENT
========================================================= */

async function validerPaiement(req, res) {

    const client =
        await pool.connect();

    try {

        const id =
            idValide(
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


        /*
           Activation automatique du Premium
        */

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


        return success(

            res,

            formatPaiement(
                final.rows[0]
            ),

            "Paiement validé et Premium activé."

        );

    }
    catch (error) {

        await client.query(
            "ROLLBACK"
        );

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


app.patch(
    "/api/paiements/:id/valider",
    validerPaiement
);


app.patch(
    "/api/payments/:id/valider",
    validerPaiement
);


app.post(
    "/api/paiements/:id/valider",
    validerPaiement
);


/* =========================================================
   27. REFUSER PAIEMENT
========================================================= */

async function refuserPaiement(req, res) {

    try {

        const id =
            idValide(
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
                first(
                    req.body || {},
                    "note",
                    "commentaire"
                ) || ""
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


        return success(

            res,

            formatPaiement(
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


app.patch(
    "/api/paiements/:id/refuser",
    refuserPaiement
);


app.patch(
    "/api/payments/:id/refuser",
    refuserPaiement
);


app.post(
    "/api/paiements/:id/refuser",
    refuserPaiement
);


/* =========================================================
   28. SUPPRIMER PAIEMENT
========================================================= */

async function supprimerPaiement(req, res) {

    try {

        const id =
            idValide(
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


        return success(

            res,

            formatPaiement(
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


app.delete(
    "/api/paiements/:id",
    supprimerPaiement
);


app.delete(
    "/api/payments/:id",
    supprimerPaiement
);


/* =========================================================
   29. ACTIVER PREMIUM MANUELLEMENT
========================================================= */

async function activerPremium(req, res) {

    try {

        const id =
            idValide(
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

                UPDATE utilisateurs

                SET

                    premium = TRUE,

                    is_premium = TRUE,

                    updated_at = NOW()

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


        return success(

            res,

            formatUtilisateur(
                result.rows[0]
            ),

            "Premium activé."

        );

    }
    catch (error) {

        return erreur(
            res,
            500,
            "Impossible d'activer Premium.",
            error
        );

    }

}


app.patch(
    "/api/utilisateurs/:id/premium",
    activerPremium
);


app.put(
    "/api/utilisateurs/:id/premium",
    activerPremium
);


app.patch(
    "/api/apprenants/:id/premium",
    activerPremium
);


app.put(
    "/api/apprenants/:id/premium",
    activerPremium
);


/* =========================================================
   30. DESACTIVER PREMIUM
========================================================= */

async function desactiverPremium(req, res) {

    try {

        const id =
            idValide(
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

                UPDATE utilisateurs

                SET

                    premium = FALSE,

                    is_premium = FALSE,

                    updated_at = NOW()

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


        return success(

            res,

            formatUtilisateur(
                result.rows[0]
            ),

            "Premium désactivé."

        );

    }
    catch (error) {

        return erreur(
            res,
            500,
            "Impossible de désactiver Premium.",
            error
        );

    }

}


app.patch(
    "/api/utilisateurs/:id/premium/desactiver",
    desactiverPremium
);


app.patch(
    "/api/apprenants/:id/premium/desactiver",
    desactiverPremium
);


/* =========================================================
   31. BLOQUER UTILISATEUR
========================================================= */

async function bloquerUtilisateur(req, res) {

    try {

        const id =
            idValide(
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

                UPDATE utilisateurs

                SET

                    bloque = TRUE,

                    updated_at = NOW()

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


        return success(

            res,

            formatUtilisateur(
                result.rows[0]
            ),

            "Utilisateur bloqué."

        );

    }
    catch (error) {

        return erreur(
            res,
            500,
            "Impossible de bloquer l'utilisateur.",
            error
        );

    }

}


app.patch(
    "/api/utilisateurs/:id/bloquer",
    bloquerUtilisateur
);


app.patch(
    "/api/apprenants/:id/bloquer",
    bloquerUtilisateur
);


/* =========================================================
   32. DEBLOQUER UTILISATEUR
========================================================= */

async function debloquerUtilisateur(req, res) {

    try {

        const id =
            idValide(
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

                UPDATE utilisateurs

                SET

                    bloque = FALSE,

                    updated_at = NOW()

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


        return success(

            res,

            formatUtilisateur(
                result.rows[0]
            ),

            "Utilisateur débloqué."

        );

    }
    catch (error) {

        return erreur(
            res,
            500,
            "Impossible de débloquer l'utilisateur.",
            error
        );

    }

}


app.patch(
    "/api/utilisateurs/:id/debloquer",
    debloquerUtilisateur
);


app.patch(
    "/api/apprenants/:id/debloquer",
    debloquerUtilisateur
);


/* =========================================================
   33. STATISTIQUES ADMIN
========================================================= */

async function statistiquesAdmin(req, res) {

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
                            OR is_premium = TRUE
                    ) AS total_premium,

                    (
                        SELECT COUNT(*)
                        FROM utilisateurs
                        WHERE bloque = TRUE
                    ) AS total_bloques,

                    (
                        SELECT COUNT(*)
                        FROM paiements
                    ) AS total_paiements,

                    (
                        SELECT COUNT(*)
                        FROM paiements
                        WHERE statut = 'en_attente'
                    ) AS total_paiements_attente,

                    (
                        SELECT COUNT(*)
                        FROM paiements
                        WHERE statut = 'valide'
                    ) AS total_paiements_valides,

                    (
                        SELECT COUNT(*)
                        FROM paiements
                        WHERE statut = 'refuse'
                    ) AS total_paiements_refuses,

                    (
                        SELECT COALESCE(
                            SUM(montant),
                            0
                        )

                        FROM paiements

                        WHERE statut = 'valide'

                    ) AS montant_total

            `);


        return success(

            res,

            result.rows[0],

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
    "/api/admin/dashboard",
    statistiquesAdmin
);


app.get(
    "/api/stats",
    statistiquesAdmin
);


/* =========================================================
   34. ROUTE ADMIN
========================================================= */

app.get(
    "/api/admin",
    async (req, res) => {

        return res.json({

            success: true,

            message:
                "API administration BMJ SERVICE opérationnelle.",

            endpoints: {

                utilisateurs:
                    "/api/utilisateurs",

                apprenants:
                    "/api/apprenants",

                paiements:
                    "/api/paiements",

                statistiques:
                    "/api/admin/statistiques",

                health:
                    "/api/health",

                routes:
                    "/api/routes"

            }

        });

    }
);


/* =========================================================
   35. API
========================================================= */

app.get(
    "/api",
    (req, res) => {

        return res.json({

            success: true,

            message:
                "BMJ SERVICE API opérationnelle.",

            version:
                "7.0.0",

            endpoints: {

                utilisateurs:
                    "/api/utilisateurs",

                apprenants:
                    "/api/apprenants",

                paiements:
                    "/api/paiements",

                admin:
                    "/api/admin",

                statistiques:
                    "/api/admin/statistiques",

                testDB:
                    "/api/test-db",

                health:
                    "/api/health",

                routes:
                    "/api/routes"

            }

        });

    }
);


/* =========================================================
   36. 404
========================================================= */

app.use(
    (req, res) => {

        return res.status(404).json({

            success: false,

            message:
                "Route introuvable.",

            route:
                req.originalUrl,

            method:
                req.method,

            api:
                "https://back-end-h602.onrender.com",

            routes:
                "/api/routes"

        });

    }
);


/* =========================================================
   37. ERREUR GLOBALE
========================================================= */

app.use(
    (error, req, res, next) => {

        console.error(
            "ERREUR GLOBALE :",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Erreur interne du serveur.",

            error:
                process.env.NODE_ENV === "production"
                    ? ""
                    : error.message

        });

    }
);


/* =========================================================
   38. DEMARRAGE
========================================================= */

async function demarrerServeur() {

    try {

        console.log(
            "=================================================="
        );

        console.log(
            "BMJ SERVICE API v7.0.0"
        );

        console.log(
            "Démarrage..."
        );


        if (!DATABASE_URL) {

            throw new Error(
                "DATABASE_URL PostgreSQL manquante."
            );

        }


        await pool.query(
            "SELECT NOW()"
        );


        console.log(
            "PostgreSQL : CONNECTÉ"
        );


        await initialiserBase();


        app.listen(

            PORT,

            () => {

                console.log(
                    "=================================================="
                );

                console.log(
                    `Serveur BMJ SERVICE : PORT ${PORT}`
                );

                console.log(
                    "URL Render : https://back-end-h602.onrender.com"
                );

                console.log(
                    "Routes : /api/routes"
                );

                console.log(
                    "Paiements : /api/paiements"
                );

                console.log(
                    "Utilisateurs : /api/utilisateurs"
                );

                console.log(
                    "=================================================="
                );

            }

        );

    }
    catch (error) {

        console.error(
            "=================================================="
        );

        console.error(
            "ERREUR DE DEMARRAGE"
        );

        console.error(
            error.message
        );

        console.error(
            "=================================================="
        );

        process.exit(1);

    }

}


/* =========================================================
   39. ARRET PROPRE
========================================================= */

async function arreter() {

    console.log(
        "Arrêt BMJ SERVICE..."
    );

    try {

        await pool.end();

    }
    catch (error) {

        console.error(
            "Erreur fermeture PostgreSQL :",
            error.message
        );

    }

    process.exit(0);

}


process.on(
    "SIGTERM",
    arreter
);


process.on(
    "SIGINT",
    arreter
);


/* =========================================================
   40. LANCEMENT
========================================================= */

demarrerServeur();