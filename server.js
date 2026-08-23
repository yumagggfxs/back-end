/* =========================================================
   BMJ SERVICE
   BACKEND API
   NODE.JS + EXPRESS + POSTGRESQL
   RENDER
========================================================= */

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;


/* =========================================================
   CONNEXION POSTGRESQL
   URL DIRECTEMENT DANS SERVER.JS
========================================================= */

const DATABASE_URL =
    "postgresql://bmj_db_user:5FSX8YeJNzwinKdFOrIeEC43aQsuzf91@dpg-d9sdlt49v7es73emrq8g-a/bmj_db";


const pool = new Pool({

    connectionString: DATABASE_URL,

    ssl: {
        rejectUnauthorized: false
    }

});


/* =========================================================
   CORS
========================================================= */

app.use(cors({
    origin: "*",
    methods: [
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "PATCH",
        "OPTIONS"
    ],
    allowedHeaders: [
        "Content-Type",
        "Authorization"
    ]
}));


/* =========================================================
   JSON
========================================================= */

app.use(express.json({
    limit: "15mb"
}));

app.use(express.urlencoded({
    extended: true,
    limit: "15mb"
}));


/* =========================================================
   TEST POSTGRESQL
========================================================= */

async function testerDatabase() {

    try {

        const result = await pool.query(
            "SELECT NOW() AS heure"
        );

        console.log("=================================");
        console.log("✅ POSTGRESQL CONNECTÉ");
        console.log("🕐 Heure :", result.rows[0].heure);
        console.log("=================================");

        return true;

    } catch (error) {

        console.error("=================================");
        console.error("❌ ERREUR POSTGRESQL");
        console.error(error.message);
        console.error("=================================");

        return false;
    }
}


/* =========================================================
   CREATION DES TABLES
========================================================= */

async function creerTables() {

    try {

        /* =====================================================
           TABLE USERS
        ===================================================== */

        await pool.query(`

            CREATE TABLE IF NOT EXISTS users (

                id SERIAL PRIMARY KEY,

                nom VARCHAR(150) NOT NULL,

                email VARCHAR(255) UNIQUE NOT NULL,

                telephone VARCHAR(50),

                password TEXT NOT NULL,

                domaine VARCHAR(150),

                premium BOOLEAN DEFAULT FALSE,

                is_premium BOOLEAN DEFAULT FALSE,

                photo TEXT,

                date_creation
                    TIMESTAMP DEFAULT CURRENT_TIMESTAMP

            );

        `);


        /* =====================================================
           TABLE PAIEMENTS
        ===================================================== */

        await pool.query(`

            CREATE TABLE IF NOT EXISTS paiements (

                id SERIAL PRIMARY KEY,

                id_paiement
                    VARCHAR(150) UNIQUE NOT NULL,

                utilisateur_id
                    VARCHAR(150),

                nom
                    VARCHAR(150),

                email
                    VARCHAR(255),

                offre
                    VARCHAR(150),

                montant
                    NUMERIC(12,2),

                devise
                    VARCHAR(10),

                methode
                    VARCHAR(100),

                capture
                    TEXT,

                statut
                    VARCHAR(50)
                    DEFAULT 'en_attente',

                date
                    TIMESTAMP DEFAULT CURRENT_TIMESTAMP

            );

        `);


        console.log("✅ TABLES VÉRIFIÉES");

    } catch (error) {

        console.error(
            "❌ ERREUR CRÉATION TABLES :",
            error.message
        );

    }
}


/* =========================================================
   PAGE PRINCIPALE
========================================================= */

app.get("/", (req, res) => {

    res.json({

        success: true,

        message:
            "BMJ SERVICE API fonctionne.",

        api: {
            testDB: "/api/test-db",
            inscription: "/api/inscription",
            connexion: "/api/connexion",
            apprenants: "/api/apprenants",
            paiements: "/api/paiements"
        }

    });

});


/* =========================================================
   TEST DATABASE
========================================================= */

app.get("/api/test-db", async (req, res) => {

    try {

        const result = await pool.query(
            "SELECT NOW() AS heure"
        );

        res.json({

            success: true,

            message:
                "PostgreSQL fonctionne.",

            database:
                result.rows[0].heure

        });

    } catch (error) {

        console.error(
            "❌ TEST DB :",
            error.message
        );

        res.status(500).json({

            success: false,

            message:
                "Erreur connexion PostgreSQL.",

            error:
                error.message

        });

    }

});


/* =========================================================
   INSCRIPTION
========================================================= */

app.post("/api/inscription", async (req, res) => {

    try {

        const {
            nom,
            email,
            telephone,
            password,
            domaine,
            photo
        } = req.body;


        /* -----------------------------------------------------
           VERIFICATION
        ----------------------------------------------------- */

        if (!nom || !email || !password) {

            return res.status(400).json({

                success: false,

                message:
                    "Nom, email et mot de passe obligatoires."

            });

        }


        const emailNormalise =
            String(email)
                .trim()
                .toLowerCase();


        /* -----------------------------------------------------
           VERIFIER SI L'EMAIL EXISTE
        ----------------------------------------------------- */

        const existe = await pool.query(`

            SELECT id

            FROM users

            WHERE email = $1

            LIMIT 1

        `, [
            emailNormalise
        ]);


        if (existe.rows.length > 0) {

            return res.status(409).json({

                success: false,

                message:
                    "Cette adresse email est déjà utilisée."

            });

        }


        /* -----------------------------------------------------
           CREER UTILISATEUR
        ----------------------------------------------------- */

        const result = await pool.query(`

            INSERT INTO users
            (
                nom,
                email,
                telephone,
                password,
                domaine,
                premium,
                is_premium,
                photo
            )

            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5,
                FALSE,
                FALSE,
                $6
            )

            RETURNING
                id,
                nom,
                email,
                telephone,
                domaine,
                premium,
                is_premium,
                photo,
                date_creation

        `, [

            nom.trim(),

            emailNormalise,

            telephone || null,

            password,

            domaine || null,

            photo || null

        ]);


        res.status(201).json({

            success: true,

            message:
                "Inscription réussie.",

            user:
                result.rows[0],

            utilisateur:
                result.rows[0]

        });


    } catch (error) {

        console.error(
            "❌ ERREUR INSCRIPTION :",
            error.message
        );

        res.status(500).json({

            success: false,

            message:
                "Erreur serveur lors de l'inscription.",

            error:
                error.message

        });

    }

});


/* =========================================================
   CONNEXION
========================================================= */

app.post("/api/connexion", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        if (!email || !password) {

            return res.status(400).json({

                success: false,

                message:
                    "Email et mot de passe obligatoires."

            });

        }


        const emailNormalise =
            String(email)
                .trim()
                .toLowerCase();


        /* -----------------------------------------------------
           RECHERCHE UTILISATEUR
        ----------------------------------------------------- */

        const result = await pool.query(`

            SELECT
                id,
                nom,
                email,
                telephone,
                password,
                domaine,
                premium,
                is_premium,
                photo,
                date_creation

            FROM users

            WHERE email = $1

            LIMIT 1

        `, [
            emailNormalise
        ]);


        if (result.rows.length === 0) {

            return res.status(401).json({

                success: false,

                message:
                    "Email ou mot de passe incorrect."

            });

        }


        const utilisateur =
            result.rows[0];


        /* -----------------------------------------------------
           VERIFICATION PASSWORD
        ----------------------------------------------------- */

        if (
            utilisateur.password !== password
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Email ou mot de passe incorrect."

            });

        }


        /* -----------------------------------------------------
           NE PAS RETOURNER LE PASSWORD
        ----------------------------------------------------- */

        delete utilisateur.password;


        res.json({

            success: true,

            message:
                "Connexion réussie.",

            user:
                utilisateur,

            utilisateur:
                utilisateur

        });


    } catch (error) {

        console.error(
            "❌ ERREUR CONNEXION :",
            error.message
        );

        res.status(500).json({

            success: false,

            message:
                "Erreur serveur lors de la connexion.",

            error:
                error.message

        });

    }

});


/* =========================================================
   RECUPERER LES APPRENANTS
========================================================= */

app.get("/api/apprenants", async (req, res) => {

    try {

        const result = await pool.query(`

            SELECT
                id,
                nom,
                email,
                telephone,
                domaine,
                premium,
                is_premium,
                photo,
                date_creation

            FROM users

            ORDER BY id DESC

        `);


        res.json({

            success: true,

            data:
                result.rows,

            total:
                result.rows.length

        });


    } catch (error) {

        console.error(
            "❌ ERREUR APPRENANTS :",
            error.message
        );

        res.status(500).json({

            success: false,

            message:
                "Impossible de récupérer les apprenants.",

            error:
                error.message

        });

    }

});


/* =========================================================
   RECUPERER LES PAIEMENTS
========================================================= */

app.get("/api/paiements", async (req, res) => {

    try {

        const result = await pool.query(`

            SELECT *

            FROM paiements

            ORDER BY id DESC

        `);


        res.json({

            success: true,

            data:
                result.rows,

            total:
                result.rows.length

        });


    } catch (error) {

        console.error(
            "❌ ERREUR PAIEMENTS :",
            error.message
        );

        res.status(500).json({

            success: false,

            message:
                "Impossible de récupérer les paiements.",

            error:
                error.message

        });

    }

});


/* =========================================================
   ENREGISTRER UN PAIEMENT
========================================================= */

app.post("/api/paiements", async (req, res) => {

    try {

        const {

            idPaiement,
            utilisateurID,
            nom,
            email,
            offre,
            montant,
            devise,
            methode,
            capture,
            statut

        } = req.body;


        if (!idPaiement || !email) {

            return res.status(400).json({

                success: false,

                message:
                    "ID paiement et email obligatoires."

            });

        }


        const emailNormalise =
            String(email)
                .trim()
                .toLowerCase();


        const existe = await pool.query(`

            SELECT id

            FROM paiements

            WHERE id_paiement = $1

            LIMIT 1

        `, [
            idPaiement
        ]);


        if (existe.rows.length > 0) {

            return res.status(409).json({

                success: false,

                message:
                    "Ce paiement existe déjà."

            });

        }


        const result = await pool.query(`

            INSERT INTO paiements
            (
                id_paiement,
                utilisateur_id,
                nom,
                email,
                offre,
                montant,
                devise,
                methode,
                capture,
                statut
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
                $10
            )

            RETURNING *

        `, [

            idPaiement,

            utilisateurID || null,

            nom || null,

            emailNormalise,

            offre || null,

            montant || 0,

            devise || "USD",

            methode || null,

            capture || null,

            statut || "en_attente"

        ]);


        res.status(201).json({

            success: true,

            message:
                "Paiement enregistré.",

            data:
                result.rows[0]

        });


    } catch (error) {

        console.error(
            "❌ ERREUR PAIEMENT :",
            error.message
        );

        res.status(500).json({

            success: false,

            message:
                "Erreur lors de l'enregistrement du paiement.",

            error:
                error.message

        });

    }

});


/* =========================================================
   ROUTE INEXISTANTE
========================================================= */

app.use((req, res) => {

    res.status(404).json({

        success: false,

        message:
            "Route introuvable.",

        route:
            req.originalUrl

    });

});


/* =========================================================
   DEMARRAGE DU SERVEUR
========================================================= */

app.listen(PORT, async () => {

    console.log("");
    console.log("========================================");
    console.log("🚀 BMJ SERVICE BACKEND");
    console.log("========================================");
    console.log("🌐 Port :", PORT);
    console.log("========================================");


    const connexion =
        await testerDatabase();


    if (connexion) {

        await creerTables();

    }

});