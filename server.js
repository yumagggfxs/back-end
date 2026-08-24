/* =========================================================
   BMJ SERVICE
   BACKEND COMPLET
   NODE.JS + EXPRESS + POSTGRESQL
   RENDER

   VERSION : 5.0.0

   =========================================================
   FONCTIONNALITÉS
   =========================================================

   UTILISATEURS
   ---------------------------------------------------------
   GET     /api/utilisateurs
   GET     /api/users
   GET     /api/utilisateur/:id
   POST    /api/utilisateurs
   POST    /api/users
   PUT     /api/utilisateur/:id
   DELETE  /api/utilisateur/:id

   PAIEMENTS
   ---------------------------------------------------------
   GET     /api/paiements
   GET     /api/payments
   GET     /api/paiement/:id
   POST    /api/paiements
   POST    /api/payments
   PUT     /api/paiement/:id
   DELETE  /api/paiement/:id

   VALIDATION
   ---------------------------------------------------------
   POST    /api/paiement/:id/valider
   PUT     /api/paiement/:id/valider
   POST    /api/paiement/:id/refuser
   PUT     /api/paiement/:id/refuser

   PREMIUM
   ---------------------------------------------------------
   POST    /api/paiement/:id/valider-premium
   POST    /api/utilisateur/:id/premium
   PUT     /api/utilisateur/:id/premium

   APPRENANTS
   ---------------------------------------------------------
   GET     /api/apprenants
   GET     /api/apprenant/:id
   POST    /api/apprenants
   PUT     /api/apprenant/:id
   DELETE  /api/apprenant/:id

   ADMIN
   ---------------------------------------------------------
   GET     /api/admin/stats
   GET     /api/admin/dashboard

   SYSTEME
   ---------------------------------------------------------
   GET     /
   GET     /api
   GET     /api/test-db
   GET     /api/health

   =========================================================
*/


/* =========================================================
   1. IMPORTATIONS
========================================================= */

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");


/* =========================================================
   2. APPLICATION
========================================================= */

const app = express();


/* =========================================================
   3. PORT
========================================================= */

const PORT =
    process.env.PORT ||
    10000;


/* =========================================================
   4. BASE DE DONNÉES POSTGRESQL
========================================================= */

/*
   Connexion directe demandée.

   IMPORTANT :
   Cette clé est maintenant exposée.
   Il faudra la régénérer sur Render après installation.
*/

const DATABASE_URL =
    "postgresql://bmj_db_user:5FSX8YeJNzwinKdFOrIeEC43aQsuzf91@dpg-d9sdlt49v7es73emrq8g-a/bmj_db";


/* =========================================================
   5. POOL POSTGRESQL
========================================================= */

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


/* =========================================================
   6. CORS
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
        limit: "15mb"
    })
);


/* =========================================================
   8. URL ENCODED
========================================================= */

app.use(
    express.urlencoded({
        extended: true,
        limit: "15mb"
    })
);


/* =========================================================
   9. LOG DES REQUÊTES
========================================================= */

app.use(
    (req, res, next) => {

        console.log(
            `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`
        );

        next();

    }
);


/* =========================================================
   10. OUTILS
========================================================= */

function envoyerSucces(
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


function envoyerErreur(
    res,
    error,
    status = 500
) {

    console.error(
        "BMJ API ERROR :",
        error
    );

    return res.status(status).json({

        success: false,

        message:
            error?.message ||
            "Une erreur serveur est survenue.",

        error:
            error?.message ||
            ""

    });

}


/* =========================================================
   11. NORMALISATION
========================================================= */

function valeurPremierObjet(
    objet,
    ...cles
) {

    for (
        const cle
        of cles
    ) {

        if (
            objet &&
            objet[cle] !== undefined &&
            objet[cle] !== null &&
            objet[cle] !== ""
        ) {

            return objet[cle];

        }

    }

    return null;

}


function nombre(
    valeur
) {

    const n =
        Number(valeur);

    return Number.isFinite(n)
        ? n
        : 0;

}


function texte(
    valeur
) {

    if (
        valeur === undefined ||
        valeur === null
    ) {

        return "";

    }

    return String(
        valeur
    ).trim();

}


function booleen(
    valeur
) {

    if (
        valeur === true ||
        valeur === "true" ||
        valeur === 1 ||
        valeur === "1"
    ) {

        return true;

    }

    return false;

}


/* =========================================================
   12. CRÉATION DES TABLES
========================================================= */

async function creerTables() {

    console.log(
        "Création / vérification des tables PostgreSQL..."
    );


    /*
       TABLE UTILISATEURS
    */

    await pool.query(`

        CREATE TABLE IF NOT EXISTS utilisateurs (

            id SERIAL PRIMARY KEY,

            nom VARCHAR(255),

            email VARCHAR(255),

            telephone VARCHAR(100),

            domaine VARCHAR(255),

            mot_de_passe TEXT,

            password TEXT,

            photo TEXT,

            premium BOOLEAN DEFAULT FALSE,

            is_premium BOOLEAN DEFAULT FALSE,

            premium_active BOOLEAN DEFAULT FALSE,

            premium_date TIMESTAMP NULL,

            premium_expiration TIMESTAMP NULL,

            role VARCHAR(50) DEFAULT 'user',

            statut VARCHAR(50) DEFAULT 'actif',

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

        );

    `);


    /*
       TABLE PAIEMENTS
    */

    await pool.query(`

        CREATE TABLE IF NOT EXISTS paiements (

            id SERIAL PRIMARY KEY,

            utilisateur_id INTEGER NULL,

            user_id INTEGER NULL,

            utilisateurID INTEGER NULL,

            nom VARCHAR(255),

            email VARCHAR(255),

            telephone VARCHAR(100),

            montant NUMERIC(15,2) DEFAULT 0,

            amount NUMERIC(15,2) DEFAULT 0,

            prix NUMERIC(15,2) DEFAULT 0,

            devise VARCHAR(20) DEFAULT 'USD',

            currency VARCHAR(20) DEFAULT 'USD',

            methode VARCHAR(100),

            method VARCHAR(100),

            mode_paiement VARCHAR(100),

            numero_operateur VARCHAR(100),

            numeroOperateur VARCHAR(100),

            numero VARCHAR(100),

            statut VARCHAR(50) DEFAULT 'en_attente',

            status VARCHAR(50) DEFAULT 'en_attente',

            reference VARCHAR(255),

            transaction_id VARCHAR(255),

            transactionId VARCHAR(255),

            capture TEXT,

            preuve TEXT,

            proof TEXT,

            image TEXT,

            preuve_paiement TEXT,

            origine VARCHAR(100),

            source VARCHAR(100),

            ajoute_par_admin BOOLEAN DEFAULT FALSE,

            note TEXT,

            commentaire TEXT,

            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            valide_par VARCHAR(255),

            valide_le TIMESTAMP NULL,

            motif_refus TEXT

        );

    `);


    /*
       TABLE APPRENANTS
    */

    await pool.query(`

        CREATE TABLE IF NOT EXISTS apprenants (

            id SERIAL PRIMARY KEY,

            nom VARCHAR(255),

            email VARCHAR(255),

            telephone VARCHAR(100),

            domaine VARCHAR(255),

            photo TEXT,

            premium BOOLEAN DEFAULT FALSE,

            is_premium BOOLEAN DEFAULT FALSE,

            statut VARCHAR(50) DEFAULT 'actif',

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

        );

    `);


    /*
       INDEX UTILISATEURS
    */

    await pool.query(`

        CREATE INDEX IF NOT EXISTS
        idx_utilisateurs_email

        ON utilisateurs(email);

    `);


    /*
       INDEX PAIEMENTS
    */

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

        ON paiements(created_at DESC);

    `);


    console.log(
        "Tables PostgreSQL prêtes."
    );

}


/* =========================================================
   13. TEST BASE DE DONNÉES
========================================================= */

async function testerConnexionDB() {

    try {

        const result =
            await pool.query(
                "SELECT NOW() AS maintenant"
            );

        console.log(
            "PostgreSQL connecté :",
            result.rows[0]
        );

        return true;

    }

    catch(error) {

        console.error(
            "PostgreSQL non disponible :",
            error.message
        );

        return false;

    }

}


/* =========================================================
   14. ROUTE PRINCIPALE
========================================================= */

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            message:
                "BMJ SERVICE API fonctionne.",

            api:
                "/api",

            version:
                "5.0.0",

            database:
                "PostgreSQL",

            server:
                "Render",

            timestamp:
                new Date().toISOString()

        });

    }
);


/* =========================================================
   15. API
========================================================= */

app.get(
    "/api",
    (req, res) => {

        res.json({

            success: true,

            message:
                "BMJ SERVICE API fonctionne.",

            version:
                "5.0.0",

            routes: {

                utilisateurs:
                    "/api/utilisateurs",

                paiements:
                    "/api/paiements",

                apprenants:
                    "/api/apprenants",

                stats:
                    "/api/admin/stats",

                testDB:
                    "/api/test-db"

            }

        });

    }
);


/* =========================================================
   16. HEALTH
========================================================= */

app.get(
    "/api/health",
    async (req, res) => {

        const debut =
            Date.now();

        try {

            await pool.query(
                "SELECT 1"
            );

            res.json({

                success: true,

                server:
                    "online",

                database:
                    "online",

                responseTime:
                    `${Date.now() - debut} ms`

            });

        }

        catch(error) {

            envoyerErreur(
                res,
                error,
                500
            );

        }

    }
);


/* =========================================================
   17. TEST DB
========================================================= */

app.get(
    "/api/test-db",
    async (req, res) => {

        try {

            const result =
                await pool.query(`
                    SELECT
                        NOW() AS heure,
                        current_database() AS database
                `);

            envoyerSucces(

                res,

                result.rows[0],

                "Connexion PostgreSQL réussie."

            );

        }

        catch(error) {

            envoyerErreur(
                res,
                error
            );

        }

    }
);


/* =========================================================
   18. GET UTILISATEURS
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


            envoyerSucces(

                res,

                result.rows,

                "Utilisateurs récupérés."

            );

        }

        catch(error) {

            envoyerErreur(
                res,
                error
            );

        }

    }
);


/*
   Alias
*/

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

            envoyerSucces(
                res,
                result.rows,
                "Utilisateurs récupérés."
            );

        }

        catch(error) {

            envoyerErreur(
                res,
                error
            );

        }

    }
);


/* =========================================================
   19. UTILISATEUR PAR ID
========================================================= */

app.get(
    "/api/utilisateur/:id",
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);


            const result =
                await pool.query(

                    `

                    SELECT *

                    FROM utilisateurs

                    WHERE id = $1

                    LIMIT 1

                    `,

                    [id]

                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable."

                });

            }


            envoyerSucces(

                res,

                result.rows[0],

                "Utilisateur récupéré."

            );

        }

        catch(error) {

            envoyerErreur(
                res,
                error
            );

        }

    }
);


/* =========================================================
   20. CRÉER UTILISATEUR
========================================================= */

async function creerUtilisateur(
    req,
    res
) {

    try {

        const body =
            req.body || {};


        const nom =
            texte(
                valeurPremierObjet(
                    body,
                    "nom",
                    "name",
                    "username"
                )
            );


        const email =
            texte(
                valeurPremierObjet(
                    body,
                    "email",
                    "mail"
                )
            );


        const telephone =
            texte(
                valeurPremierObjet(
                    body,
                    "telephone",
                    "phone",
                    "tel"
                )
            );


        const domaine =
            texte(
                valeurPremierObjet(
                    body,
                    "domaine",
                    "domain"
                )
            );


        const motDePasse =
            texte(
                valeurPremierObjet(
                    body,
                    "mot_de_passe",
                    "password",
                    "motDePasse"
                )
            );


        const photo =
            texte(
                valeurPremierObjet(
                    body,
                    "photo",
                    "image"
                )
            );


        const premium =
            booleen(
                valeurPremierObjet(
                    body,
                    "premium",
                    "is_premium",
                    "premium_active"
                )
            );


        if (!nom) {

            return res.status(400).json({

                success: false,

                message:
                    "Le nom est obligatoire."

            });

        }


        /*
           Vérification email
        */

        if (email) {

            const existe =
                await pool.query(

                    `

                    SELECT id

                    FROM utilisateurs

                    WHERE LOWER(email) =
                          LOWER($1)

                    LIMIT 1

                    `,

                    [email]

                );


            if (
                existe.rows.length > 0
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Cette adresse email existe déjà."

                });

            }

        }


        const result =
            await pool.query(

                `

                INSERT INTO utilisateurs (

                    nom,

                    email,

                    telephone,

                    domaine,

                    mot_de_passe,

                    password,

                    photo,

                    premium,

                    is_premium,

                    premium_active

                )

                VALUES (

                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $5,
                    $6,
                    $7,
                    $7,
                    $7

                )

                RETURNING *

                `,

                [

                    nom,

                    email,

                    telephone,

                    domaine,

                    motDePasse,

                    photo,

                    premium

                ]

            );


        return envoyerSucces(

            res,

            result.rows[0],

            "Utilisateur créé avec succès."

        );

    }

    catch(error) {

        return envoyerErreur(
            res,
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


/* =========================================================
   21. MODIFIER UTILISATEUR
========================================================= */

app.put(
    "/api/utilisateur/:id",
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);

            const body =
                req.body || {};


            const result =
                await pool.query(

                    `

                    UPDATE utilisateurs

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

                        premium =
                            COALESCE($6, premium),

                        is_premium =
                            COALESCE($6, is_premium),

                        premium_active =
                            COALESCE($6, premium_active),

                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE id = $7

                    RETURNING *

                    `,

                    [

                        body.nom ??
                        body.name ??
                        null,

                        body.email ??
                        null,

                        body.telephone ??
                        body.phone ??
                        null,

                        body.domaine ??
                        null,

                        body.photo ??
                        null,

                        body.premium !== undefined
                            ? booleen(body.premium)
                            : body.is_premium !== undefined
                                ? booleen(body.is_premium)
                                : null,

                        id

                    ]

                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable."

                });

            }


            envoyerSucces(

                res,

                result.rows[0],

                "Utilisateur modifié."

            );

        }

        catch(error) {

            envoyerErreur(
                res,
                error
            );

        }

    }
);


/* =========================================================
   22. SUPPRIMER UTILISATEUR
========================================================= */

app.delete(
    "/api/utilisateur/:id",
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);


            const result =
                await pool.query(

                    `

                    DELETE FROM utilisateurs

                    WHERE id = $1

                    RETURNING *

                    `,

                    [id]

                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable."

                });

            }


            envoyerSucces(

                res,

                result.rows[0],

                "Utilisateur supprimé."

            );

        }

        catch(error) {

            envoyerErreur(
                res,
                error
            );

        }

    }
);


/* =========================================================
   23. GET PAIEMENTS
========================================================= */

app.get(
    "/api/paiements",
    async (req, res) => {

        try {

            const result =
                await pool.query(`

                    SELECT

                        p.*,

                        COALESCE(
                            p.utilisateur_id,
                            p.user_id,
                            p.utilisateurID
                        ) AS user_id_final

                    FROM paiements p

                    ORDER BY
                        p.created_at DESC,
                        p.id DESC

                `);


            envoyerSucces(

                res,

                result.rows,

                "Paiements récupérés."

            );

        }

        catch(error) {

            envoyerErreur(
                res,
                error
            );

        }

    }
);


/* =========================================================
   24. ALIAS PAYMENTS
========================================================= */

app.get(
    "/api/payments",
    async (req, res) => {

        try {

            const result =
                await pool.query(`

                    SELECT *

                    FROM paiements

                    ORDER BY
                        created_at DESC,
                        id DESC

                `);


            envoyerSucces(

                res,

                result.rows,

                "Paiements récupérés."

            );

        }

        catch(error) {

            envoyerErreur(
                res,
                error
            );

        }

    }
);


/* =========================================================
   25. PAIEMENT PAR ID
========================================================= */

app.get(
    "/api/paiement/:id",
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);


            const result =
                await pool.query(

                    `

                    SELECT *

                    FROM paiements

                    WHERE id = $1

                    LIMIT 1

                    `,

                    [id]

                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Paiement introuvable."

                });

            }


            envoyerSucces(

                res,

                result.rows[0],

                "Paiement récupéré."

            );

        }

        catch(error) {

            envoyerErreur(
                res,
                error
            );

        }

    }
);


/* =========================================================
   26. CRÉATION PAIEMENT
========================================================= */

async function creerPaiement(
    req,
    res
) {

    try {

        const body =
            req.body || {};


        /*
           IDENTIFIANT UTILISATEUR
        */

        const utilisateurId =
            valeurPremierObjet(

                body,

                "utilisateur_id",
                "utilisateurID",
                "user_id",
                "userId"

            );


        const userId =
            utilisateurId
                ? Number(utilisateurId)
                : null;


        /*
           INFORMATIONS
        */

        const nom =
            texte(
                valeurPremierObjet(
                    body,
                    "nom",
                    "name"
                )
            );


        const email =
            texte(
                valeurPremierObjet(
                    body,
                    "email"
                )
            );


        const telephone =
            texte(
                valeurPremierObjet(
                    body,
                    "telephone",
                    "phone"
                )
            );


        /*
           MONTANT
        */

        const montant =
            nombre(
                valeurPremierObjet(
                    body,
                    "montant",
                    "amount",
                    "prix"
                )
            );


        if (
            montant <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Le montant doit être supérieur à zéro."

            });

        }


        /*
           AUTRES INFORMATIONS
        */

        const devise =
            texte(
                valeurPremierObjet(
                    body,
                    "devise",
                    "currency"
                )
            ) ||
            "USD";


        const methode =
            texte(
                valeurPremierObjet(
                    body,
                    "methode",
                    "method",
                    "mode_paiement"
                )
            );


        const numero =
            texte(
                valeurPremierObjet(
                    body,
                    "numero_operateur",
                    "numeroOperateur",
                    "operator_number",
                    "numero"
                )
            );


        const statut =
            texte(
                valeurPremierObjet(
                    body,
                    "statut",
                    "status"
                )
            ) ||
            "en_attente";


        const date =
            valeurPremierObjet(
                body,
                "date",
                "date_creation",
                "created_at"
            );


        const reference =
            texte(
                valeurPremierObjet(
                    body,
                    "reference",
                    "transaction_id",
                    "transactionId"
                )
            );


        const preuve =
            texte(
                valeurPremierObjet(
                    body,
                    "preuve",
                    "proof",
                    "capture",
                    "image",
                    "preuve_paiement"
                )
            );


        const origine =
            texte(
                valeurPremierObjet(
                    body,
                    "origine",
                    "source"
                )
            );


        const ajouteParAdmin =
            booleen(
                valeurPremierObjet(
                    body,
                    "ajoute_par_admin"
                )
            );


        const note =
            texte(
                valeurPremierObjet(
                    body,
                    "note",
                    "commentaire"
                )
            );


        /*
           Date sûre
        */

        let dateFinale =
            new Date();


        if (date) {

            const tentative =
                new Date(date);


            if (
                !Number.isNaN(
                    tentative.getTime()
                )
            ) {

                dateFinale =
                    tentative;

            }

        }


        /*
           INSERT RAPIDE
        */

        const result =
            await pool.query(

                `

                INSERT INTO paiements (

                    utilisateur_id,

                    user_id,

                    utilisateurID,

                    nom,

                    email,

                    telephone,

                    montant,

                    amount,

                    prix,

                    devise,

                    currency,

                    methode,

                    method,

                    mode_paiement,

                    numero_operateur,

                    numeroOperateur,

                    numero,

                    statut,

                    status,

                    reference,

                    transaction_id,

                    transactionId,

                    capture,

                    preuve,

                    proof,

                    image,

                    preuve_paiement,

                    origine,

                    source,

                    ajoute_par_admin,

                    note,

                    commentaire,

                    date,

                    date_creation,

                    created_at

                )

                VALUES (

                    $1,
                    $1,
                    $1,

                    $2,
                    $3,
                    $4,

                    $5,
                    $5,
                    $5,

                    $6,
                    $6,

                    $7,
                    $7,
                    $7,

                    $8,
                    $8,
                    $8,

                    $9,
                    $9,

                    $10,
                    $10,
                    $10,

                    $11,
                    $11,
                    $11,
                    $11,
                    $11,

                    $12,
                    $12,

                    $13,

                    $14,
                    $14,

                    $15,
                    $15,
                    $15

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

                    reference,

                    preuve,

                    origine,

                    ajouteParAdmin,

                    note,

                    dateFinale

                ]

            );


        const paiement =
            result.rows[0];


        console.log(
            "BMJ → PAIEMENT ENREGISTRÉ :",
            paiement.id
        );


        return envoyerSucces(

            res,

            paiement,

            "Paiement enregistré avec succès."

        );

    }

    catch(error) {

        return envoyerErreur(
            res,
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
   27. MODIFIER PAIEMENT
========================================================= */

app.put(
    "/api/paiement/:id",
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);


            const body =
                req.body || {};


            const statut =
                texte(
                    valeurPremierObjet(
                        body,
                        "statut",
                        "status"
                    )
                );


            const note =
                texte(
                    valeurPremierObjet(
                        body,
                        "note",
                        "commentaire"
                    )
                );


            const reference =
                texte(
                    valeurPremierObjet(
                        body,
                        "reference",
                        "transaction_id"
                    )
                );


            const result =
                await pool.query(

                    `

                    UPDATE paiements

                    SET

                        statut =
                            COALESCE(
                                NULLIF($1, ''),
                                statut
                            ),

                        status =
                            COALESCE(
                                NULLIF($1, ''),
                                status
                            ),

                        note =
                            COALESCE(
                                NULLIF($2, ''),
                                note
                            ),

                        commentaire =
                            COALESCE(
                                NULLIF($2, ''),
                                commentaire
                            ),

                        reference =
                            COALESCE(
                                NULLIF($3, ''),
                                reference
                            ),

                        transaction_id =
                            COALESCE(
                                NULLIF($3, ''),
                                transaction_id
                            ),

                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE id = $4

                    RETURNING *

                    `,

                    [

                        statut,

                        note,

                        reference,

                        id

                    ]

                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Paiement introuvable."

                });

            }


            envoyerSucces(

                res,

                result.rows[0],

                "Paiement modifié."

            );

        }

        catch(error) {

            envoyerErreur(
                res,
                error
            );

        }

    }
);


/* =========================================================
   28. VALIDER PAIEMENT
========================================================= */

async function validerPaiement(
    req,
    res
) {

    const client =
        await pool.connect();


    try {

        const id =
            Number(req.params.id);


        await client.query(
            "BEGIN"
        );


        const paiementResult =
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
            paiementResult.rows.length === 0
        ) {

            await client.query(
                "ROLLBACK"
            );

            return res.status(404).json({

                success: false,

                message:
                    "Paiement introuvable."

            });

        }


        const paiement =
            paiementResult.rows[0];


        const utilisateurId =
            paiement.utilisateur_id ||
            paiement.user_id ||
            paiement.utilisateurid;


        /*
           Mise à jour paiement
        */

        const updatePaiement =
            await client.query(

                `

                UPDATE paiements

                SET

                    statut = 'valide',

                    status = 'valide',

                    valide_le =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = $1

                RETURNING *

                `,

                [id]

            );


        /*
           Activation Premium
        */

        let utilisateur =
            null;


        if (utilisateurId) {

            const userResult =
                await client.query(

                    `

                    UPDATE utilisateurs

                    SET

                        premium = TRUE,

                        is_premium = TRUE,

                        premium_active = TRUE,

                        premium_date =
                            CURRENT_TIMESTAMP,

                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE id = $1

                    RETURNING *

                    `,

                    [utilisateurId]

                );


            if (
                userResult.rows.length > 0
            ) {

                utilisateur =
                    userResult.rows[0];

            }

        }


        /*
           Si l'utilisateur n'est
           pas trouvé par ID,
           tentative par email.
        */

        if (
            !utilisateur &&
            paiement.email
        ) {

            const userResult =
                await client.query(

                    `

                    UPDATE utilisateurs

                    SET

                        premium = TRUE,

                        is_premium = TRUE,

                        premium_active = TRUE,

                        premium_date =
                            CURRENT_TIMESTAMP,

                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE LOWER(email) =
                          LOWER($1)

                    RETURNING *

                    `,

                    [paiement.email]

                );


            if (
                userResult.rows.length > 0
            ) {

                utilisateur =
                    userResult.rows[0];

            }

        }


        await client.query(
            "COMMIT"
        );


        console.log(

            `BMJ → PAIEMENT ${id} VALIDÉ`

        );


        envoyerSucces(

            res,

            {

                paiement:
                    updatePaiement.rows[0],

                utilisateur

            },

            "Paiement validé et Premium activé."

        );

    }

    catch(error) {

        await client.query(
            "ROLLBACK"
        );


        envoyerErreur(
            res,
            error
        );

    }

    finally {

        client.release();

    }

}


app.post(
    "/api/paiement/:id/valider",
    validerPaiement
);


app.put(
    "/api/paiement/:id/valider",
    validerPaiement
);


app.post(
    "/api/paiement/:id/valider-premium",
    validerPaiement
);


/* =========================================================
   29. REFUSER PAIEMENT
========================================================= */

async function refuserPaiement(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        const motif =
            texte(
                req.body?.motif ||
                req.body?.reason ||
                req.body?.note
            );


        const result =
            await pool.query(

                `

                UPDATE paiements

                SET

                    statut = 'refuse',

                    status = 'refuse',

                    motif_refus = $1,

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = $2

                RETURNING *

                `,

                [

                    motif,

                    id

                ]

            );


        if (
            result.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Paiement introuvable."

            });

        }


        envoyerSucces(

            res,

            result.rows[0],

            "Paiement refusé."

        );

    }

    catch(error) {

        envoyerErreur(
            res,
            error
        );

    }

}


app.post(
    "/api/paiement/:id/refuser",
    refuserPaiement
);


app.put(
    "/api/paiement/:id/refuser",
    refuserPaiement
);


/* =========================================================
   30. ACTIVATION PREMIUM MANUELLE
========================================================= */

async function activerPremium(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        const result =
            await pool.query(

                `

                UPDATE utilisateurs

                SET

                    premium = TRUE,

                    is_premium = TRUE,

                    premium_active = TRUE,

                    premium_date =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = $1

                RETURNING *

                `,

                [id]

            );


        if (
            result.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Utilisateur introuvable."

            });

        }


        envoyerSucces(

            res,

            result.rows[0],

            "Compte Premium activé."

        );

    }

    catch(error) {

        envoyerErreur(
            res,
            error
        );

    }

}


app.post(
    "/api/utilisateur/:id/premium",
    activerPremium
);


app.put(
    "/api/utilisateur/:id/premium",
    activerPremium
);


/* =========================================================
   31. APPRENANTS
========================================================= */

app.get(
    "/api/apprenants",
    async (req, res) => {

        try {

            const result =
                await pool.query(`

                    SELECT *

                    FROM apprenants

                    ORDER BY id DESC

                `);


            envoyerSucces(

                res,

                result.rows,

                "Apprenants récupérés."

            );

        }

        catch(error) {

            envoyerErreur(
                res,
                error
            );

        }

    }
);


/* =========================================================
   32. APPRENANT PAR ID
========================================================= */

app.get(
    "/api/apprenant/:id",
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);


            const result =
                await pool.query(

                    `

                    SELECT *

                    FROM apprenants

                    WHERE id = $1

                    LIMIT 1

                    `,

                    [id]

                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Apprenant introuvable."

                });

            }


            envoyerSucces(

                res,

                result.rows[0],

                "Apprenant récupéré."

            );

        }

        catch(error) {

            envoyerErreur(
                res,
                error
            );

        }

    }
);


/* =========================================================
   33. CRÉER APPRENANT
========================================================= */

app.post(
    "/api/apprenants",
    async (req, res) => {

        try {

            const body =
                req.body || {};


            const nom =
                texte(
                    body.nom ||
                    body.name
                );


            const email =
                texte(
                    body.email
                );


            const telephone =
                texte(
                    body.telephone ||
                    body.phone
                );


            const domaine =
                texte(
                    body.domaine ||
                    body.domain
                );


            const photo =
                texte(
                    body.photo ||
                    body.image
                );


            const premium =
                booleen(
                    body.premium ||
                    body.is_premium
                );


            if (!nom) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le nom est obligatoire."

                });

            }


            const result =
                await pool.query(

                    `

                    INSERT INTO apprenants (

                        nom,

                        email,

                        telephone,

                        domaine,

                        photo,

                        premium,

                        is_premium

                    )

                    VALUES (

                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $6

                    )

                    RETURNING *

                    `,

                    [

                        nom,

                        email,

                        telephone,

                        domaine,

                        photo,

                        premium

                    ]

                );


            envoyerSucces(

                res,

                result.rows[0],

                "Apprenant créé."

            );

        }

        catch(error) {

            envoyerErreur(
                res,
                error
            );

        }

    }
);


/* =========================================================
   34. MODIFIER APPRENANT
========================================================= */

app.put(
    "/api/apprenant/:id",
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);


            const body =
                req.body || {};


            const result =
                await pool.query(

                    `

                    UPDATE apprenants

                    SET

                        nom =
                            COALESCE(
                                $1,
                                nom
                            ),

                        email =
                            COALESCE(
                                $2,
                                email
                            ),

                        telephone =
                            COALESCE(
                                $3,
                                telephone
                            ),

                        domaine =
                            COALESCE(
                                $4,
                                domaine
                            ),

                        photo =
                            COALESCE(
                                $5,
                                photo
                            ),

                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE id = $6

                    RETURNING *

                    `,

                    [

                        body.nom ??
                        body.name ??
                        null,

                        body.email ??
                        null,

                        body.telephone ??
                        body.phone ??
                        null,

                        body.domaine ??
                        null,

                        body.photo ??
                        null,

                        id

                    ]

                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Apprenant introuvable."

                });

            }


            envoyerSucces(

                res,

                result.rows[0],

                "Apprenant modifié."

            );

        }

        catch(error) {

            envoyerErreur(
                res,
                error
            );

        }

    }
);


/* =========================================================
   35. SUPPRIMER APPRENANT
========================================================= */

app.delete(
    "/api/apprenant/:id",
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);


            const result =
                await pool.query(

                    `

                    DELETE FROM apprenants

                    WHERE id = $1

                    RETURNING *

                    `,

                    [id]

                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Apprenant introuvable."

                });

            }


            envoyerSucces(

                res,

                result.rows[0],

                "Apprenant supprimé."

            );

        }

        catch(error) {

            envoyerErreur(
                res,
                error
            );

        }

    }
);


/* =========================================================
   36. STATISTIQUES ADMIN
========================================================= */

async function statistiquesAdmin(
    req,
    res
) {

    try {

        const [

            utilisateurs,

            premium,

            paiements,

            attente,

            valides,

            refuses,

            montant

        ] =
            await Promise.all([

                pool.query(`
                    SELECT COUNT(*)::int AS total
                    FROM utilisateurs
                `),

                pool.query(`
                    SELECT COUNT(*)::int AS total
                    FROM utilisateurs
                    WHERE
                        premium = TRUE
                        OR is_premium = TRUE
                        OR premium_active = TRUE
                `),

                pool.query(`
                    SELECT COUNT(*)::int AS total
                    FROM paiements
                `),

                pool.query(`
                    SELECT COUNT(*)::int AS total
                    FROM paiements
                    WHERE
                        statut = 'en_attente'
                        OR status = 'en_attente'
                `),

                pool.query(`
                    SELECT COUNT(*)::int AS total
                    FROM paiements
                    WHERE
                        statut = 'valide'
                        OR status = 'valide'
                `),

                pool.query(`
                    SELECT COUNT(*)::int AS total
                    FROM paiements
                    WHERE
                        statut = 'refuse'
                        OR status = 'refuse'
                `),

                pool.query(`
                    SELECT
                        COALESCE(
                            SUM(montant),
                            0
                        ) AS total
                    FROM paiements
                    WHERE
                        statut = 'valide'
                        OR status = 'valide'
                `)

            ]);


        envoyerSucces(

            res,

            {

                utilisateurs:
                    utilisateurs.rows[0].total,

                total_utilisateurs:
                    utilisateurs.rows[0].total,

                premium:
                    premium.rows[0].total,

                comptes_premium:
                    premium.rows[0].total,

                paiements:
                    paiements.rows[0].total,

                paiements_en_attente:
                    attente.rows[0].total,

                paiements_valides:
                    valides.rows[0].total,

                paiements_refuses:
                    refuses.rows[0].total,

                montant_valide:
                    montant.rows[0].total

            },

            "Statistiques récupérées."

        );

    }

    catch(error) {

        envoyerErreur(
            res,
            error
        );

    }

}


app.get(
    "/api/admin/stats",
    statistiquesAdmin
);


app.get(
    "/api/admin/dashboard",
    statistiquesAdmin
);


/* =========================================================
   37. ROUTE 404
========================================================= */

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "Route API introuvable.",

            method:
                req.method,

            route:
                req.originalUrl

        });

    }
);


/* =========================================================
   38. GESTION ERREUR EXPRESS
========================================================= */

app.use(
    (error, req, res, next) => {

        console.error(
            "ERREUR EXPRESS :",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Erreur interne du serveur.",

            error:
                error.message

        });

    }
);


/* =========================================================
   39. DÉMARRAGE SERVEUR
========================================================= */

async function demarrerServeur() {

    console.log(
        "=============================================="
    );

    console.log(
        "        BMJ SERVICE BACKEND"
    );

    console.log(
        "        VERSION 5.0.0"
    );

    console.log(
        "=============================================="
    );


    /*
       Vérification DB
    */

    const dbOK =
        await testerConnexionDB();


    if (!dbOK) {

        console.error(
            "ATTENTION : PostgreSQL n'est pas accessible."
        );

    }

    else {

        /*
           Création des tables uniquement
           lorsque PostgreSQL répond.
        */

        try {

            await creerTables();

        }

        catch(error) {

            console.error(

                "Erreur création tables :",

                error.message

            );

        }

    }


    /*
       Démarrage HTTP
    */

    app.listen(

        PORT,

        () => {

            console.log(
                "=============================================="
            );

            console.log(
                `BMJ SERVICE API démarrée sur le port ${PORT}`
            );

            console.log(
                `URL locale : http://localhost:${PORT}`
            );

            console.log(
                "PostgreSQL : connecté"
            );

            console.log(
                "=============================================="
            );

        }

    );

}


/* =========================================================
   40. ARRÊT PROPRE
========================================================= */

process.on(
    "SIGTERM",
    async () => {

        console.log(
            "SIGTERM reçu."
        );


        await pool.end();


        process.exit(0);

    }
);


process.on(
    "SIGINT",
    async () => {

        console.log(
            "SIGINT reçu."
        );


        await pool.end();


        process.exit(0);

    }
);


/* =========================================================
   41. LANCEMENT
========================================================= */

demarrerServeur();