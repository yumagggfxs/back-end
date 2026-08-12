const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const axios = require('axios'); // N'oubliez pas de faire : npm install axios

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Connection PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://bmj_db_user:5FSX8YeJNzwinKdFOrIeEC43aQsuzf91@dpg-d9sdlt49v7es73emrq8g-a/bmj_db',
    ssl: { rejectUnauthorized: false }
});

// Identifiants Airtel Money (à configurer dans les variables d'environnement Render)
const AIRTEL_CLIENT_ID = process.env.AIRTEL_CLIENT_ID || "VOTRE_CLIENT_ID";
const AIRTEL_CLIENT_SECRET = process.env.AIRTEL_CLIENT_SECRET || "VOTRE_CLIENT_SECRET";
const AIRTEL_ENV_URL = process.env.AIRTEL_ENV_URL || "https://openapiuat.airtel.africa"; // UAT (Test) ou Prod

// 👉 Initialisation des tables SQL
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
    console.log("✅ Tables PostgreSQL initialisées !");
}).catch(err => {
    console.error("❌ Erreur tables SQL :", err);
});

// 🔑 Fonction pour obtenir le jeton d'accès Airtel Money
async function getAirtelToken() {
    try {
        const response = await axios.post(`${AIRTEL_ENV_URL}/auth/oauth2/token`, {
            client_id: AIRTEL_CLIENT_ID,
            client_secret: AIRTEL_CLIENT_SECRET,
            grant_type: "client_credentials"
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        return response.data.access_token;
    } catch (error) {
        console.error("Erreur Auth Airtel :", error.response?.data || error.message);
        throw new Error("Impossible de s'authentifier auprès d'Airtel");
    }
}

// 💳 Route pour initier un paiement Airtel Money (POST)
app.post('/api/payer-cours', async (req, res) => {
    const { apprenant_id, cours_nom, montant, telephone } = req.body;

    if (!apprenant_id || !cours_nom || !montant || !telephone) {
        return res.status(400).json({ success: false, error: "Tous les champs sont requis." });
    }

    try {
        const reference = `REF-${Date.now()}`;

        // 1. Enregistrer le paiement en attente dans la base de données
        await pool.query(
            `INSERT INTO paiements (apprenant_id, cours_nom, montant, telephone_payeur, reference_transaction, statut) 
             VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
            [apprenant_id, cours_nom, montant, telephone, reference]
        );

        // 2. Récupérer le Token Airtel
        const token = await getAirtelToken();

        // 3. Lancer la requête de paiement Push USSD auprès d'Airtel
        const airtelPayload = {
            reference: reference,
            subscriber: {
                country: "CD", // Ex: CD pour RDC, CG pour Congo Bzz, GA pour Gabon
                currency: "CDF", // Devise (ex: CDF ou USD)
                msisdn: telephone.replace('+', '').trim() // Nettoyage du numéro
            },
            transaction: {
                amount: parseFloat(montant),
                country: "CD",
                currency: "CDF",
                id: reference
            }
        };

        const airtelRes = await axios.post(
            `${AIRTEL_ENV_URL}/merchant/v1/payments/`,
            airtelPayload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': '*/*',
                    'X-Country': 'CD',
                    'X-Currency': 'CDF',
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        res.json({
            success: true,
            message: "Demande envoyée ! Veuillez valider le paiement sur votre téléphone.",
            reference: reference,
            airtelDetails: airtelRes.data
        });

    } catch (err) {
        console.error("Erreur Paiement :", err.response?.data || err.message);
        res.status(500).json({
            success: false,
            error: "Échec du déclenchement du paiement. Vérifiez le numéro de téléphone."
        });
    }
});

// 🔔 Route Webhook Airtel (Pour recevoir la confirmation automatique)
app.post('/api/airtel-webhook', async (req, res) => {
    const { transaction } = req.body;
    
    if (transaction) {
        const reference = transaction.id;
        const status = transaction.status; // 'SUCCESS' ou 'FAILED'

        if (status === 'SUCCESS') {
            await pool.query(
                `UPDATE paiements SET statut = 'SUCCESS' WHERE reference_transaction = $1`,
                [reference]
            );
            console.log(`✅ Paiement validé pour la référence : ${reference}`);
        }
    }
    res.status(200).send("OK");
});

// --- Vos routes existantes ---
app.post('/api/apprenants', async (req, res) => { /* ... */ });
app.post('/api/connexion', async (req, res) => { /* ... */ });
app.get('/api/apprenants', async (req, res) => { /* ... */ });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});