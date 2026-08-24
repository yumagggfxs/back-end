/* =========================================================
   BMJ SERVICE
   BACKEND API COMPLET
   NODE.JS + EXPRESS + POSTGRESQL
   RENDER

   VERSION : 7.0.0

   COMPATIBLE AVEC :
   - FRONTEND BMJ SERVICE
   - ADMIN BMJ SERVICE
   - UTILISATEURS
   - INSCRIPTIONS
   - PAIEMENTS
   - PREMIUM
   - BLOCAGE
   - PREUVES DE PAIEMENT
   - PAIEMENTS AJOUTÉS MANUELLEMENT
   - VALIDATION
   - REFUS
   - SUPPRESSION
   - STATISTIQUES
   - AUTO REFRESH ADMIN

   =========================================================

   VARIABLES RENDER :

   DATABASE_URL =
   ta connexion PostgreSQL Render

   PORT =
   Render fournit automatiquement PORT

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
   3. CONFIGURATION POSTGRESQL
========================================================= */

/*
   IMPORTANT :

   Sur Render, ajoute :

   DATABASE_URL

   dans :

   Dashboard Render
   → Service
   → Environment
   → Add Environment Variable

   Ne mets pas le mot de passe directement dans GitHub.
*/

const DATABASE_URL =
    process.env.DATABASE_URL || "postgresql://bmj_db_user:5FSX8YeJNzwinKdFOrIeEC43aQsuzf91@dpg-d9sdlt49v7es73emrq8g-a/bmj_db";


/*
   Vérification de la configuration.
*/

if (!DATABASE_URL) {

    console.error(
        "================================================="
    );

    console.error(
        "ERREUR : DATABASE_URL est absente."
    );

    console.error(
        "Ajoute DATABASE_URL dans les variables Render."
    );

    console.error(
        "================================================="
    );

}


/* =========================================================
   4. POOL POSTGRESQL
========================================================= */

const pool =
    new Pool({

        connectionString:
            DATABASE_URL,

        ssl:
            process.env.NODE_ENV === "production"
                ? {
                    rejectUnauthorized: false
                }
                : false,

        max:
            10,

        idleTimeoutMillis:
            30000,

        connectionTimeoutMillis:
            10000

    });


/* =========================================================
   5. GESTION ERREUR POOL
========================================================= */

pool.on(
    "error",
    (error) => {

        console.error(
            "ERREUR POSTGRESQL POOL :",
            error.message
        );

    }
);


/* =========================================================
   6. MIDDLEWARE CORS
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
   7. JSON
========================================================= */

app.use(

    express.json({

        limit:
            "20mb"

    })

);


/* =========================================================
   8. FORM DATA
========================================================= */

app.use(

    express.urlencoded({

        extended:
            true,

        limit:
            "20mb"

    })

);


/* =========================================================
   9. LOG DES REQUÊTES
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

                    `[API] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duree}ms)`

                );

            }

        );


        next();

    }

);


/* =========================================================
   10. RÉPONSES STANDARD
========================================================= */

function success(

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
        "[API ERROR]",
        message,
        error?.message || ""
    );


    return res.status(status).json({

        success:
            false,

        message,

        error:
            process.env.NODE_ENV === "production"
                ? ""
                : error?.message || ""

    });

}


/* =========================================================
   11. OUTILS
========================================================= */

function boolean(value) {

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

    if (!object) {

        return null;

    }


    for (

        const key of keys

    ) {

        if (

            object[key] !== undefined &&
            object[key] !== null

        ) {

            return object[key];

        }

    }


    return null;

}


function integerId(value) {

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


function dateValide(value) {

    if (!value) {

        return new Date();

    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return new Date();

    }


    return date;

}


/* =========================================================
   12. FORMAT UTILISATEUR
========================================================= */

function formatUtilisateur(row) {

    if (!row) {

        return null;

    }


    const premium =
        boolean(
            row.premium
        ) ||
        boolean(
            row.is_premium
        );


    const bloque =
        boolean(
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
   13. FORMAT PAIEMENT
========================================================= */

function formatPaiement(row) {

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

        numeroOperateur:
            row.numero_operateur || "",

        numero_operateur:
            row.numero_operateur || "",

        operator_number:
            row.numero_operateur || "",

        statut,

        status:
            statut,

        etat:
            statut,

        date:
            row.date_paiement ||
            row.created_at,

        date_paiement:
            row.date_paiement,

        datePaiement:
            row.date_paiement,

        reference,

        transaction_id:
            reference,

        transactionId:
            reference,

        capture:
            preuve,

        preuve,

        proof:
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
            "",

        origine:
            row.origine || "",

        source:
            row.source || "",

        ajoute_par_admin:
            boolean(
                row.ajoute_par_admin
            ),

        added_by_admin:
            boolean(
                row.added_by_admin
            )

    };

}


/* =========================================================
   14. TEST DB
========================================================= */

async function testDatabase() {

    const result =
        await pool.query(
            "SELECT NOW() AS maintenant"
        );


    return result.rows[0];

}


/* =========================================================
   15. INITIALISATION BASE
========================================================= */

async function initialiserBase() {

    console.log(
        "Initialisation PostgreSQL..."
    );


    /* =====================================================
       UTILISATEURS
    ===================================================== */

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

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

        );

    `);


    /* =====================================================
       PAIEMENTS
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
       INDEX UTILISATEURS
    ===================================================== */

    await pool.query(`

        CREATE INDEX IF NOT EXISTS
        idx_utilisateurs_email

        ON utilisateurs(email);

    `);


    await pool.query(`

        CREATE INDEX IF NOT EXISTS
        idx_utilisateurs_telephone

        ON utilisateurs(telephone);

    `);


    /* =====================================================
       INDEX PAIEMENTS
    ===================================================== */

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
        idx_paiements_reference

        ON paiements(reference);

    `);


    await pool.query(`

        CREATE INDEX IF NOT EXISTS
        idx_paiements_date

        ON paiements(date_paiement DESC);

    `);


    console.log(
        "PostgreSQL : tables et index prêts."
    );

}


/* =========================================================
   16. ROUTE RACINE
========================================================= */

app.get(

    "/",

    async (req, res) => {

        let database =
            "offline";


        try {

            await testDatabase();

            database =
                "online";

        }

        catch(error) {

            console.error(
                "DB ROOT :",
                error.message
            );

        }


        return res.json({

            success:
                true,

            message:
                "BMJ SERVICE API fonctionne.",

            api:
                "/api",

            database,

            version:
                "7.0.0",

            server:
                "Node.js + Express",

            database_type:
                "PostgreSQL"

        });

    }

);


/* =========================================================
   17. HEALTH
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

                timestamp:
                    new Date().toISOString()

            });

        }

        catch(error) {

            return res.status(503).json({

                success:
                    false,

                status:
                    "offline",

                database:
                    "offline",

                timestamp:
                    new Date().toISOString()

            });

        }

    }

);


/* =========================================================
   18. TEST DATABASE
========================================================= */

app.get(

    "/api/test-db",

    async (req, res) => {

        try {

            const result =
                await testDatabase();


            return res.json({

                success:
                    true,

                message:
                    "Connexion PostgreSQL réussie.",

                database:
                    "PostgreSQL",

                time:
                    result.maintenant

            });

        }

        catch(error) {

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
   19. LISTE DES ROUTES
========================================================= */

app.get(

    "/api/routes",

    (req, res) => {

        return res.json({

            success:
                true,

            message:
                "Routes BMJ SERVICE API",

            routes: [

                "GET /",

                "GET /api",

                "GET /api/health",

                "GET /api/test-db",

                "GET /api/routes",

                "GET /api/utilisateurs",

                "GET /api/users",

                "GET /api/utilisateurs/:id",

                "GET /api/utilisateurs/recherche",

                "POST /api/utilisateurs",

                "PUT /api/utilisateurs/:id",

                "PATCH /api/utilisateurs/:id",

                "DELETE /api/utilisateurs/:id",

                "GET /api/paiements",

                "GET /api/payments",

                "GET /api/paiements/:id",

                "POST /api/paiements",

                "PUT /api/paiements/:id",

                "PATCH /api/paiements/:id",

                "DELETE /api/paiements/:id",

                "PATCH /api/paiements/:id/valider",

                "PATCH /api/paiements/:id/refuser",

                "GET /api/admin/statistiques"

            ]

        });

    }

);


/* =========================================================
   20. ROUTE API
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
                "7.0.0",

            routes:
                "/api/routes"

        });

    }

);


/* =========================================================
   21. GET UTILISATEURS
========================================================= */

app.get(

    "/api/utilisateurs",

    async (req, res) => {

        try {

            const result =
                await pool.query(`

                    SELECT *

                    FROM utilisateurs

                    ORDER BY id DESC

                `);


            return success(

                res,

                result.rows.map(
                    formatUtilisateur
                ),

                "Utilisateurs récupérés."

            );

        }

        catch(error) {

            return erreur(

                res,

                500,

                "Impossible de récupérer les utilisateurs.",

                error

            );

        }

    }

);


/* =========================================================
   22. ALIAS USERS
========================================================= */

app.get(

    "/api/users",

    async (req, res) => {

        try {

            const result =
                await pool.query(`

                    SELECT *

                    FROM utilisateurs

                    ORDER BY id DESC

                `);


            return success(

                res,

                result.rows.map(
                    formatUtilisateur
                ),

                "Utilisateurs récupérés."

            );

        }

        catch(error) {

            return erreur(

                res,

                500,

                "Impossible de récupérer les utilisateurs.",

                error

            );

        }

    }

);


/* =========================================================
   23. RECHERCHE UTILISATEUR
========================================================= */

app.get(

    "/api/utilisateurs/recherche",

    async (req, res) => {

        try {

            const recherche =
                String(
                    req.query.q || ""
                ).trim();


            if (!recherche) {

                return erreur(

                    res,

                    400,

                    "Le paramètre q est obligatoire."

                );

            }


            const result =
                await pool.query(

                    `

                    SELECT *

                    FROM utilisateurs

                    WHERE

                        LOWER(nom)
                        LIKE LOWER($1)

                        OR

                        LOWER(email)
                        LIKE LOWER($1)

                        OR

                        telephone
                        LIKE $1

                    ORDER BY id DESC

                    `,

                    [`%${recherche}%`]

                );


            return success(

                res,

                result.rows.map(
                    formatUtilisateur
                ),

                "Recherche terminée."

            );

        }

        catch(error) {

            return erreur(

                res,

                500,

                "Erreur pendant la recherche.",

                error

            );

        }

    }

);


/* =========================================================
   24. GET UTILISATEUR ID
========================================================= */

app.get(

    "/api/utilisateurs/:id",

    async (req, res) => {

        try {

            const id =
                integerId(
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
                ),

                "Utilisateur récupéré."

            );

        }

        catch(error) {

            return erreur(

                res,

                500,

                "Impossible de récupérer l'utilisateur.",

                error

            );

        }

    }

);


/* =========================================================
   25. CREER UTILISATEUR
========================================================= */

app.post(

    "/api/utilisateurs",

    async (req, res) => {

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
                ).trim();


            const email =
                String(
                    first(
                        body,
                        "email"
                    ) || ""
                ).trim();


            const telephone =
                String(
                    first(
                        body,
                        "telephone",
                        "phone"
                    ) || ""
                ).trim();


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
                boolean(
                    first(
                        body,
                        "premium",
                        "is_premium",
                        "isPremium"
                    )
                );


            const bloque =
                boolean(
                    first(
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


            return success(

                res,

                formatUtilisateur(
                    result.rows[0]
                ),

                "Utilisateur créé."

            );

        }

        catch(error) {

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
   26. MODIFIER UTILISATEUR
========================================================= */

async function modifierUtilisateur(

    req,
    res

) {

    try {

        const id =
            integerId(
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
            body.domaine !== undefined ||
            body.domain !== undefined
        ) {

            ajouter(

                "domaine",

                String(
                    first(
                        body,
                        "domaine",
                        "domain"
                    ) || ""
                )

            );

        }


        if (
            body.photo !== undefined ||
            body.image !== undefined
        ) {

            ajouter(

                "photo",

                String(
                    first(
                        body,
                        "photo",
                        "image"
                    ) || ""
                )

            );

        }


        if (
            body.mot_de_passe !== undefined ||
            body.password !== undefined ||
            body.motDePasse !== undefined
        ) {

            ajouter(

                "mot_de_passe",

                String(
                    first(
                        body,
                        "mot_de_passe",
                        "password",
                        "motDePasse"
                    ) || ""
                )

            );

        }


        if (

            body.premium !== undefined ||
            body.is_premium !== undefined ||
            body.isPremium !== undefined

        ) {

            const premium =
                boolean(
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

            const bloque =
                boolean(
                    first(
                        body,
                        "bloque",
                        "blocked"
                    )
                );


            ajouter(
                "bloque",
                bloque
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

    catch(error) {

        return erreur(

            res,

            500,

            "Impossible de modifier l'utilisateur.",

            error

        );

    }

}


/* =========================================================
   27. PUT UTILISATEUR
========================================================= */

app.put(

    "/api/utilisateurs/:id",

    modifierUtilisateur

);


/* =========================================================
   28. PATCH UTILISATEUR
========================================================= */

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

        const client =
            await pool.connect();


        try {

            const id =
                integerId(
                    req.params.id
                );


            if (!id) {

                return erreur(

                    res,

                    400,

                    "ID utilisateur invalide."

                );

            }


            await client.query(
                "BEGIN"
            );


            const utilisateur =
                await client.query(

                    `

                    SELECT *

                    FROM utilisateurs

                    WHERE id = $1

                    `,

                    [id]

                );


            if (!utilisateur.rows.length) {

                await client.query(
                    "ROLLBACK"
                );


                return erreur(

                    res,

                    404,

                    "Utilisateur introuvable."

                );

            }


            await client.query(

                `

                DELETE FROM utilisateurs

                WHERE id = $1

                `,

                [id]

            );


            await client.query(
                "COMMIT"
            );


            return success(

                res,

                formatUtilisateur(
                    utilisateur.rows[0]
                ),

                "Utilisateur supprimé."

            );

        }

        catch(error) {

            await client.query(
                "ROLLBACK"
            );


            return erreur(

                res,

                500,

                "Impossible de supprimer l'utilisateur.",

                error

            );

        }

        finally {

            client.release();

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
                    ON u.id = p.utilisateur_id

                ORDER BY

                    p.date_paiement
                    DESC NULLS LAST,

                    p.id DESC

            `);


        const paiements =
            result.rows.map(

                row =>

                    formatPaiement({

                        ...row,

                        nom:
                            row.utilisateur_nom,

                        email:
                            row.utilisateur_email,

                        telephone:
                            row.utilisateur_telephone

                    })

            );


        return success(

            res,

            paiements,

            "Paiements récupérés."

        );

    }

    catch(error) {

        return erreur(

            res,

            500,

            "Impossible de récupérer les paiements.",

            error

        );

    }

}


/* =========================================================
   31. ROUTE PAIEMENTS
========================================================= */

app.get(

    "/api/paiements",

    recupererPaiements

);


/* =========================================================
   32. ALIAS PAYMENTS
========================================================= */

app.get(

    "/api/payments",

    recupererPaiements

);


/* =========================================================
   33. GET PAIEMENT PAR ID
========================================================= */

app.get(

    "/api/paiements/:id",

    async (req, res) => {

        try {

            const id =
                integerId(
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
                        ON u.id = p.utilisateur_id

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


            const row =
                result.rows[0];


            return success(

                res,

                formatPaiement({

                    ...row,

                    nom:
                        row.utilisateur_nom,

                    email:
                        row.utilisateur_email,

                    telephone:
                        row.utilisateur_telephone

                }),

                "Paiement récupéré."

            );

        }

        catch(error) {

            return erreur(

                res,

                500,

                "Impossible de récupérer le paiement.",

                error

            );

        }

    }

);


/* =========================================================
   34. CREER PAIEMENT
========================================================= */

app.post(

    "/api/paiements",

    async (req, res) => {

        try {

            const body =
                req.body || {};


            const utilisateurIdBrut =
                first(

                    body,

                    "utilisateurID",
                    "utilisateur_id",
                    "user_id",
                    "userId",
                    "userID"

                );


            let utilisateurId =
                null;


            if (

                utilisateurIdBrut !== null &&
                utilisateurIdBrut !== undefined &&
                utilisateurIdBrut !== ""

            ) {

                utilisateurId =
                    integerId(
                        utilisateurIdBrut
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

                !Number.isFinite(
                    montant
                ) ||

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
                        "mode_paiement",
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


            let statut =
                String(
                    first(
                        body,
                        "statut",
                        "status",
                        "etat"
                    ) || "en_attente"
                );


            statut =
                statut.toLowerCase();


            const statutsAutorises = [

                "en_attente",
                "valide",
                "refuse"

            ];


            if (
                !statutsAutorises.includes(
                    statut
                )
            ) {

                statut =
                    "en_attente";

            }


            const date =
                dateValide(

                    first(

                        body,

                        "date",
                        "date_paiement",
                        "datePaiement",
                        "date_creation",
                        "created_at"

                    )

                );


            const reference =
                String(
                    first(
                        body,
                        "reference",
                        "transaction_id",
                        "transactionId",
                        "reference_transaction"
                    ) || ""
                );


            const preuve =
                String(
                    first(
                        body,
                        "capture",
                        "preuve",
                        "proof",
                        "image",
                        "preuve_paiement",
                        "capture_paiement"
                    ) || ""
                );


            const origine =
                String(
                    first(
                        body,
                        "origine"
                    ) || ""
                );


            const source =
                String(
                    first(
                        body,
                        "source"
                    ) || ""
                );


            const admin =
                boolean(
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


            /*
               INSERT DIRECT.

               Une seule requête PostgreSQL.
               Pas de délai inutile.
            */

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

                        date,

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


            /*
               Si le paiement est directement créé comme
               valide, activation Premium immédiate.
            */

            if (

                statut === "valide" &&
                utilisateurId

            ) {

                await pool.query(

                    `

                    UPDATE utilisateurs

                    SET

                        premium = TRUE,

                        is_premium = TRUE,

                        updated_at = NOW()

                    WHERE id = $1

                    `,

                    [utilisateurId]

                );

            }


            return success(

                res,

                formatPaiement(
                    result.rows[0]
                ),

                "Paiement enregistré."

            );

        }

        catch(error) {

            return erreur(

                res,

                500,

                "Impossible d'enregistrer le paiement.",

                error

            );

        }

    }

);


/* =========================================================
   35. MODIFIER PAIEMENT
========================================================= */

async function modifierPaiement(
    req,
    res
) {

    try {

        const id =
            integerId(
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

            const nouveauStatut =
                String(
                    statut
                ).toLowerCase();


            if (

                ![
                    "en_attente",
                    "valide",
                    "refuse"
                ].includes(
                    nouveauStatut
                )

            ) {

                return erreur(

                    res,

                    400,

                    "Statut de paiement invalide."

                );

            }


            ajouter(
                "statut",
                nouveauStatut
            );

        }


        const preuve =
            first(

                body,

                "capture",
                "preuve",
                "proof",
                "image",
                "preuve_paiement",
                "capture_paiement"

            );


        if (preuve !== null) {

            ajouter(

                "preuve",

                String(
                    preuve || ""
                )

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

                String(
                    reference || ""
                )

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

                String(
                    note || ""
                )

            );


            ajouter(

                "commentaire",

                String(
                    note || ""
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


        const paiement =
            result.rows[0];


        /*
           Si statut = valide,
           Premium est activé.
        */

        if (

            paiement.statut === "valide" &&
            paiement.utilisateur_id

        ) {

            await pool.query(

                `

                UPDATE utilisateurs

                SET

                    premium = TRUE,

                    is_premium = TRUE,

                    updated_at = NOW()

                WHERE id = $1

                `,

                [paiement.utilisateur_id]

            );

        }


        return success(

            res,

            formatPaiement(
                paiement
            ),

            "Paiement modifié."

        );

    }

    catch(error) {

        return erreur(

            res,

            500,

            "Impossible de modifier le paiement.",

            error

        );

    }

}


/* =========================================================
   36. PUT PAIEMENT
========================================================= */

app.put(

    "/api/paiements/:id",

    modifierPaiement

);


/* =========================================================
   37. PATCH PAIEMENT
========================================================= */

app.patch(

    "/api/paiements/:id",

    modifierPaiement

);


/* =========================================================
   38. VALIDER PAIEMENT
========================================================= */

app.patch(

    "/api/paiements/:id/valider",

    async (req, res) => {

        const client =
            await pool.connect();


        try {

            const id =
                integerId(
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


            /*
               Verrouille le paiement pendant
               l'opération.
            */

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


            /*
               Mise à jour paiement.
            */

            const paiementFinal =
                await client.query(

                    `

                    UPDATE paiements

                    SET

                        statut = 'valide',

                        updated_at = NOW()

                    WHERE id = $1

                    RETURNING *

                    `,

                    [id]

                );


            /*
               Activation Premium.
            */

            if (
                p.utilisateur_id
            ) {

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


            await client.query(
                "COMMIT"
            );


            return success(

                res,

                formatPaiement(
                    paiementFinal.rows[0]
                ),

                "Paiement validé et Premium activé."

            );

        }

        catch(error) {

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

);


/* =========================================================
   39. REFUSER PAIEMENT
========================================================= */

app.patch(

    "/api/paiements/:id/refuser",

    async (req, res) => {

        const client =
            await pool.connect();


        try {

            const id =
                integerId(
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


            const result =
                await client.query(

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


            /*
               On ne retire PAS automatiquement Premium
               ici.

               Pourquoi ?

               Un utilisateur peut avoir plusieurs paiements.
               Refuser un ancien paiement ne doit pas forcément
               supprimer son Premium actuel.
            */


            await client.query(
                "COMMIT"
            );


            return success(

                res,

                formatPaiement(
                    result.rows[0]
                ),

                "Paiement refusé."

            );

        }

        catch(error) {

            await client.query(
                "ROLLBACK"
            );


            return erreur(

                res,

                500,

                "Impossible de refuser le paiement.",

                error

            );

        }

        finally {

            client.release();

        }

    }

);


/* =========================================================
   40. SUPPRIMER PAIEMENT
========================================================= */

app.delete(

    "/api/paiements/:id",

    async (req, res) => {

        try {

            const id =
                integerId(
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

        catch(error) {

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
   41. STATISTIQUES ADMIN
========================================================= */

app.get(

    "/api/admin/statistiques",

    async (req, res) => {

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

                            SELECT COUNT(*)

                            FROM paiements

                        ) AS total_paiements,


                        (

                            SELECT COALESCE(
                                SUM(montant),
                                0
                            )

                            FROM paiements

                            WHERE statut = 'valide'

                        ) AS montant_total_valide

                `);


            const statistiques =
                result.rows[0];


            return success(

                res,

                {

                    ...statistiques,

                    total_utilisateurs:
                        Number(
                            statistiques.total_utilisateurs
                        ),

                    total_premium:
                        Number(
                            statistiques.total_premium
                        ),

                    total_bloques:
                        Number(
                            statistiques.total_bloques
                        ),

                    total_paiements_attente:
                        Number(
                            statistiques.total_paiements_attente
                        ),

                    total_paiements_valides:
                        Number(
                            statistiques.total_paiements_valides
                        ),

                    total_paiements_refuses:
                        Number(
                            statistiques.total_paiements_refuses
                        ),

                    total_paiements:
                        Number(
                            statistiques.total_paiements
                        ),

                    montant_total_valide:
                        Number(
                            statistiques.montant_total_valide
                        )

                },

                "Statistiques récupérées."

            );

        }

        catch(error) {

            return erreur(

                res,

                500,

                "Impossible de récupérer les statistiques.",

                error

            );

        }

    }

);


/* =========================================================
   42. SYNCHRONISATION PREMIUM
========================================================= */

/*
   Cette route permet à l'administration de demander
   au serveur de recalculer le Premium à partir des paiements
   validés.

   Exemple :

   POST /api/admin/synchroniser-premium
*/

app.post(

    "/api/admin/synchroniser-premium",

    async (req, res) => {

        const client =
            await pool.connect();


        try {

            await client.query(
                "BEGIN"
            );


            /*
               Tous les utilisateurs ayant au moins
               un paiement valide deviennent Premium.
            */

            await client.query(`

                UPDATE utilisateurs u

                SET

                    premium = TRUE,

                    is_premium = TRUE,

                    updated_at = NOW()

                WHERE EXISTS (

                    SELECT 1

                    FROM paiements p

                    WHERE

                        p.utilisateur_id = u.id

                        AND

                        p.statut = 'valide'

                );

            `);


            /*
               Les utilisateurs sans aucun paiement valide
               ne sont pas automatiquement désactivés ici.

               Cela évite de retirer accidentellement un Premium
               attribué manuellement.
            */


            await client.query(
                "COMMIT"
            );


            return success(

                res,

                null,

                "Synchronisation Premium terminée."

            );

        }

        catch(error) {

            await client.query(
                "ROLLBACK"
            );


            return erreur(

                res,

                500,

                "Impossible de synchroniser Premium.",

                error

            );

        }

        finally {

            client.release();

        }

    }

);


/* =========================================================
   43. 404
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
   44. ERREUR GLOBALE
========================================================= */

app.use(

    (errorGlobal, req, res, next) => {

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
   45. DEMARRAGE
========================================================= */

async function demarrerServeur() {

    try {

        console.log(
            "================================================="
        );

        console.log(
            "BMJ SERVICE API 7.0.0"
        );

        console.log(
            "Démarrage du serveur..."
        );

        console.log(
            "================================================="
        );


        if (!DATABASE_URL) {

            throw new Error(
                "DATABASE_URL n'est pas configurée."
            );

        }


        /*
           Test PostgreSQL.
        */

        await testDatabase();


        console.log(
            "PostgreSQL : connexion réussie."
        );


        /*
           Création des tables.
        */

        await initialiserBase();


        /*
           Démarrage HTTP.
        */

        app.listen(

            PORT,

            () => {

                console.log(
                    "================================================="
                );

                console.log(
                    `BMJ SERVICE API : PORT ${PORT}`
                );

                console.log(
                    "PostgreSQL : CONNECTÉ"
                );

                console.log(
                    "API : ONLINE"
                );

                console.log(
                    `Routes : /api/routes`
                );

                console.log(
                    "================================================="
                );

            }

        );

    }

    catch(error) {

        console.error(
            "================================================="
        );

        console.error(
            "ERREUR DÉMARRAGE BMJ SERVICE"
        );

        console.error(
            error.message
        );

        console.error(
            "================================================="
        );


        process.exit(
            1
        );

    }

}


/* =========================================================
   46. ARRÊT SIGTERM
========================================================= */

process.on(

    "SIGTERM",

    async () => {

        console.log(
            "SIGTERM reçu. Fermeture..."
        );


        try {

            await pool.end();

        }

        catch(error) {

            console.error(
                error.message
            );

        }


        process.exit(
            0
        );

    }

);


/* =========================================================
   47. ARRÊT SIGINT
========================================================= */

process.on(

    "SIGINT",

    async () => {

        console.log(
            "SIGINT reçu. Fermeture..."
        );


        try {

            await pool.end();

        }

        catch(error) {

            console.error(
                error.message
            );

        }


        process.exit(
            0
        );

    }

);


/* =========================================================
   48. LANCEMENT
========================================================= */

demarrerServeur();