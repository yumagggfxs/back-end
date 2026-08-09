const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Connexion à votre base PostgreSQL sur Render
const pool = new Pool({
    connectionString: 'postgresql://bmj_db_user:5FSX8YeJNzwinKdFOrIeEC43aQsuzf91@dpg-d9sdlt49v7es73emrq8g-a/bmj_db',
    ssl: { rejectUnauthorized: false }
});

// 👉 CRÉATION AUTOMATIQUE DE LA TABLE AU DÉMARRAGE
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
`).then(() => {
    console.log("✅ Table 'apprenants' prête (créée ou déjà existante) !");
}).catch(err => {
    console.error("❌ Erreur table :", err);
});

// Route pour enregistrer un apprenant (POST)
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
        
        // Capture l'erreur d'unicité PostgreSQL (Code 23505 : violation de contrainte unique sur l'email)
        if (err.code === '23505') {
            return res.status(400).json({ 
                success: false, 
                error: "Cet e-mail est déjà utilisé par un autre compte !" 
            });
        }
        
        res.status(500).json({ success: false, error: "Erreur lors de l'enregistrement sur le serveur." });
    }
});

// 👉 Route pour connecter un apprenant (POST) - AJOUTÉE ICI
app.post('/api/connexion', async (req, res) => {
    const { identifiant, password } = req.body;

    try {
        // Recherche par email
        let query = 'SELECT * FROM apprenants WHERE email = $1';
        let values = [identifiant];

        let utilisateur = await pool.query(query, values);

        // Si non trouvé par email, on essaie par l'ID numérique si l'identifiant est un nombre
        if (utilisateur.rows.length === 0 && !isNaN(identifiant)) {
            query = 'SELECT * FROM apprenants WHERE id = $1';
            values = [parseInt(identifiant)];
            utilisateur = await pool.query(query, values);
        }

        if (utilisateur.rows.length === 0) {
            return res.status(400).json({ success: false, error: "Compte introuvable." });
        }

        const apprenant = utilisateur.rows[0];

        // Vérification du mot de passe
        if (apprenant.password !== password) {
            return res.status(400).json({ success: false, error: "Mot de passe incorrect." });
        }

        // Connexion réussie
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

// Route pour lister tous les apprenants (GET)
app.get('/api/apprenants', async (req, res) => {
    try {
        const allApprenants = await pool.query('SELECT * FROM apprenants ORDER BY date_inscription DESC');
        res.json(allApprenants.rows);
    } catch (err) {
        console.error("Erreur lecture :", err.message);
        res.status(500).json({ success: false, error: "Erreur serveur" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});