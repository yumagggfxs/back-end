const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Connection à la base PostgreSQL sur Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://bmj_db_user:5FSX8YeJNzwinKdFOrIeEC43aQsuzf91@dpg-d9sdlt49v7es73emrq8g-a/bmj_db',
    ssl: { rejectUnauthorized: false }
});

// Identifiants Airtel Money (Intégrés directement + secours par variables)
const AIRTEL_CLIENT_ID = process.env.AIRTEL_CLIENT_ID || "VOTRE_CLIENT_ID";
const AIRTEL_CLIENT_SECRET = process.env.AIRTEL_CLIENT_SECRET || "VOTRE_CLIENT_SECRET";
const AIRTEL_WEBHOOK_SECRET = process.env.AIRTEL_WEBHOOK_SECRET || "4a6b14aa75414105a9f8dd93d6ff3176";
const AIRTEL_ENV_URL = process.env.AIRTEL_ENV_URL || "https://openapiuat.airtel.africa"; // URL de Sandbox (Test)

// 👉 INITIALISATION DES TABLES POSTGRESQL
pool.query(`
    CREATE TABLE IF NOT EXISTS apprenants (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(150) NOT NULL,
        sexe VARCHAR(50),
        pays VARCHAR(100),
        telephone VARCHAR(50),
        ville VARCHAR(100),
        email VARCHAR(150) UNIQUE NOT NULL,
        domaine VARCHAR(150),
        niveau VARCHAR(100),
        password VARCHAR(255) NOT NULL,
        photo TEXT,
        date_inscription TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS paiements (
        id SERIAL PRIMARY KEY,
        apprenant_id INT REFERENCES apprenants(id),
        cours_nom VARCHAR(150) NOT NULL,
        montant NUMERIC NOT NULL,
        devise VARCHAR(10) DEFAULT 'CDF',
        telephone_payeur VARCHAR(50) NOT NULL,
        reference_transaction VARCHAR(100) UNIQUE,
        statut VARCHAR(50) DEFAULT 'PENDING',
        date_paiement TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`).then(() => {
    console.log("✅ Tables PostgreSQL 'apprenants' et 'paiements' prêtes !");
}).catch(err => {
    console.error("❌ Erreur tables SQL :", err);
});

// 🔑 FONCTION : Obtenir le jeton d'authentification Airtel Money (via fetch natif)
async function getAirtelToken() {
    try {
        const response = await fetch(`${AIRTEL_ENV_URL}/auth/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: AIRTEL_CLIENT_ID,
                client_secret: AIRTEL_CLIENT_SECRET,
                grant_type: "client_credentials"
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error_description || "Échec d'authentification Airtel");
        }
        return data.access_token;
    } catch (error) {
        console.error("Erreur Auth Airtel :", error.message);
        throw new Error("Impossible de s'authentifier auprès d'Airtel Money.");
    }
}

// 💳 ROUTE : Enregistrer un nouvel apprenant (POST)
app.post('/api/apprenants', async (req, res) => {
    const { nom, sexe, pays, telephone, ville, email, domaine, niveau, password, photo } = req.body;
    
    try {
        const query = `
            INSERT INTO apprenants (nom, sexe, pays, telephone, ville, email, domaine, niveau, password, photo) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
            RETURNING *;
        `;
        const values = [nom, sexe, pays, telephone, ville, email, domaine, niveau, password, photo];
        
        const newApprenant = await pool.query(query, values);
        res.status(201).json({ success: true, data: newApprenant.rows[0] });
    } catch (err) {
        console.error("Erreur insertion :", err.message);
        if (err.code === '23505') {
            return res.status(400).json({ 
                success: false, 
                error: "Cet e-mail est déjà utilisé par un autre compte !" 
            });
        }
        res.status(500).json({ success: false, error: "Erreur lors de l'enregistrement sur le serveur." });
    }
});

// 🔑 ROUTE : Connexion apprenant (POST)
app.post('/api/connexion', async (req, res) => {
    const { identifiant, password } = req.body;

    try {
        let query = 'SELECT * FROM apprenants WHERE email = $1';
        let values = [identifiant];

        let utilisateur = await pool.query(query, values);

        if (utilisateur.rows.length === 0 && !isNaN(identifiant)) {
            query = 'SELECT * FROM apprenants WHERE id = $1';
            values = [parseInt(identifiant)];
            utilisateur = await pool.query(query, values);
        }

        if (utilisateur.rows.length === 0) {
            return res.status(400).json({ success: false, error: "Compte introuvable." });
        }

        const apprenant = utilisateur.rows[0];

        if (apprenant.password !== password) {
            return res.status(400).json({ success: false, error: "Mot de passe incorrect." });
        }

        res.json({ 
            success: true, 
            message: "Connexion réussie !", 
            data: apprenant 
        });

    } catch (err) {
        console.error("Erreur lors de la connexion :", err.message);
        res.status(500).json({ success: false, error: "Erreur serveur lors de la connexion." });
    }
});

// 📜 ROUTE : Lister tous les apprenants (GET)
app.get('/api/apprenants', async (req, res) => {
    try {
        const allApprenants = await pool.query('SELECT * FROM apprenants ORDER BY date_inscription DESC');
        res.json(allApprenants.rows);
    } catch (err) {
        console.error("Erreur lecture :", err.message);
        res.status(500).json({ success: false, error: "Erreur serveur" });
    }
});

// 📲 ROUTE : Initier un paiement Airtel Money Collection (POST)
app.post('/api/payer-cours', async (req, res) => {
    const { apprenant_id, cours_nom, montant, telephone } = req.body;

    if (!apprenant_id || !cours_nom || !montant || !telephone) {
        return res.status(400).json({ success: false, error: "Toutes les informations du paiement sont requises." });
    }

    try {
        const reference = `REF-${Date.now()}`;
        // Nettoyage du numéro de téléphone (enlève le symbole + et les espaces)
        const telephonePropre = telephone.replace('+', '').replace(/\s+/g, '').trim();

        // 1. Enregistrer la transaction en attente dans la table "paiements"
        await pool.query(
            `INSERT INTO paiements (apprenant_id, cours_nom, montant, telephone_payeur, reference_transaction, statut) 
             VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
            [apprenant_id, cours_nom, montant, telephonePropre, reference]
        );

        // 2. Récupérer le Jeton Airtel Money
        const token = await getAirtelToken();

        // 3. Préparer le corps de la requête pour Airtel
        const airtelPayload = {
            reference: reference,
            subscriber: {
                country: "CD",
                currency: "CDF",
                msisdn: telephonePropre
            },
            transaction: {
                amount: parseFloat(montant),
                country: "CD",
                currency: "CDF",
                id: reference
            }
        };

        // 4. Appel de l'API Airtel Money Collection via fetch natif
        const airtelRes = await fetch(`${AIRTEL_ENV_URL}/merchant/v1/payments/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': '*/*',
                'X-Country': 'CD',
                'X-Currency': 'CDF',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(airtelPayload)
        });

        const airtelData = await airtelRes.json();

        if (!airtelRes.ok) {
            console.error("Réponse Erreur Airtel :", airtelData);
            return res.status(400).json({
                success: false,
                error: airtelData.status?.message || "La demande de paiement a été rejetée par Airtel."
            });
        }

        res.json({
            success: true,
            message: "Demande envoyée ! Veuillez valider le paiement sur votre téléphone.",
            reference: reference,
            airtelDetails: airtelData
        });

    } catch (err) {
        console.error("Erreur serveur paiement :", err.message);
        res.status(500).json({
            success: false,
            error: "Erreur serveur lors de la tentative de paiement."
        });
    }
});

// 🔔 ROUTE : Webhook Airtel (Compatible GET/POST)
app.all('/api/airtel-webhook', async (req, res) => {
    // Si Airtel teste l'URL via une requête GET (ping)
    if (req.method === 'GET') {
        return res.status(200).send("OK");
    }

    // Si Airtel envoie la notification de paiement via POST
    if (req.method === 'POST') {
        try {
            const { transaction } = req.body || {};
            
            if (transaction) {
                const reference = transaction.id;
                const status = transaction.status; // 'SUCCESS' ou 'FAILED'

                if (status === 'SUCCESS') {
                    await pool.query(
                        `UPDATE paiements SET statut = 'SUCCESS' WHERE reference_transaction = $1`,
                        [reference]
                    );
                    console.log(`✅ Paiement validé avec succès pour la référence : ${reference}`);
                }
            }
            return res.status(200).json({ status: "SUCCESS", message: "Webhook reçu avec succès" });
        } catch (err) {
            console.error("Erreur lors du traitement du webhook :", err.message);
            return res.status(200).json({ status: "ERROR", message: "Erreur traitée" });
        }
    }

    res.status(200).send("OK");
});

// Lancement du serveur Express
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur BMJ démarré sur le port ${PORT}`);
});