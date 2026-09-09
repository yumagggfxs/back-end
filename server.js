const cors = require("cors");
const { Pool } = require("pg");
const crypto = require("crypto");

const app = express();

const PORT = Number(process.env.PORT || 10000);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@bmjservice.com";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "change-this-secret";
const NODE_ENV = process.env.NODE_ENV || "development";

if (!process.env.DATABASE_URL) {
    console.warn("⚠️ DATABASE_URL n'est pas définie.");
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

/* ============================================================
   MIDDLEWARE
============================================================ */

app.disable("x-powered-by");

app.use(cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"]
}));

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`
    );
    next();
});

/* ============================================================
   HELPERS
============================================================ */

function success(res, data = null, message = "Opération réussie", status = 200) {
    return res.status(status).json({
        success: true,
        message,
        data
    });
}

function error(res, message = "Une erreur est survenue.", status = 500, details = undefined) {
    const payload = {
        success: false,
        message
    };

    if (details && NODE_ENV !== "production") {
        payload.error = details;
    }

    return res.status(status).json(payload);
}

function parseId(value) {
    const id = Number.parseInt(value, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function getBoolean(value) {
    if (
        value === true ||
        value === 1 ||
        value === "1" ||
        String(value).toLowerCase() === "true"
    ) {
        return true;
    }

    return false;
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function createAdminToken() {
    return crypto
        .createHmac("sha256", ADMIN_SECRET)
        .update(ADMIN_EMAIL)
        .digest("hex");
}

function safeCompare(a, b) {
    const aa = Buffer.from(String(a || ""));
    const bb = Buffer.from(String(b || ""));

    if (aa.length !== bb.length) return false;

    return crypto.timingSafeEqual(aa, bb);
}

function adminAuth(req, res, next) {
    const authorization = req.headers.authorization || "";

    let token = null;

    if (authorization.startsWith("Bearer ")) {
        token = authorization.slice(7).trim();
    }

    if (!token && req.query.token) {
        token = String(req.query.token);
    }

    if (!token || !safeCompare(token, createAdminToken())) {
        return error(res, "Accès administrateur non autorisé.", 401);
    }

    req.admin = {
        email: ADMIN_EMAIL
    };

    next();
}

function hashPassword(password) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString("hex");

        crypto.scrypt(String(password), salt, 64, (err, derivedKey) => {
            if (err) return reject(err);

            resolve(`${salt}:${derivedKey.toString("hex")}`);
        });
    });
}

function verifyPassword(password, stored) {
    return new Promise((resolve, reject) => {
        if (!stored || !stored.includes(":")) {
            return resolve(false);
        }

        const [salt, keyHex] = stored.split(":");

        crypto.scrypt(String(password), salt, 64, (err, derivedKey) => {
            if (err) return reject(err);

            const storedKey = Buffer.from(keyHex, "hex");

            if (storedKey.length !== derivedKey.length) {
                return resolve(false);
            }

            resolve(crypto.timingSafeEqual(storedKey, derivedKey));
        });
    });
}

function sanitizeUser(row) {
    if (!row) return null;

    return {
        id: row.id,
        nom: row.nom,
        email: row.email,
        telephone: row.telephone,
        domaine: row.domaine,
        photo: row.photo,
        premium: Boolean(row.premium || row.is_premium),
        is_premium: Boolean(row.is_premium || row.premium),
        premium_until: row.premium_until,
        blocked: Boolean(row.blocked || row.is_blocked),
        is_blocked: Boolean(row.is_blocked || row.blocked),
        created_at: row.created_at,
        updated_at: row.updated_at
    };
}

async function logActivity(action, details = "", userId = null, paymentId = null, req = null) {
    try {
        await pool.query(
            `INSERT INTO admin_activity
                (admin_email, action, details, user_id, payment_id, ip, user_agent)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
                ADMIN_EMAIL,
                action,
                typeof details === "string"
                    ? details
                    : JSON.stringify(details),
                userId,
                paymentId,
                req?.ip || null,
                req?.get?.("user-agent") || null
            ]
        );
    } catch (err) {
        console.warn("⚠️ Journal admin non enregistré:", err.message);
    }
}

/* ============================================================
   DATABASE INITIALIZATION
============================================================ */

async function initializeDatabase() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                nom VARCHAR(150) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                telephone VARCHAR(50),
                domaine VARCHAR(150),
                password TEXT,
                photo TEXT,
                premium BOOLEAN DEFAULT FALSE,
                is_premium BOOLEAN DEFAULT FALSE,
                premium_until TIMESTAMPTZ,
                blocked BOOLEAN DEFAULT FALSE,
                is_blocked BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        await client.query(`
            ALTER TABLE users
                ADD COLUMN IF NOT EXISTS nom VARCHAR(150),
                ADD COLUMN IF NOT EXISTS email VARCHAR(255),
                ADD COLUMN IF NOT EXISTS telephone VARCHAR(50),
                ADD COLUMN IF NOT EXISTS domaine VARCHAR(150),
                ADD COLUMN IF NOT EXISTS password TEXT,
                ADD COLUMN IF NOT EXISTS photo TEXT,
                ADD COLUMN IF NOT EXISTS premium BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS paiements (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                nom VARCHAR(150),
                email VARCHAR(255),
                telephone VARCHAR(50),
                amount NUMERIC(12,2),
                montant NUMERIC(12,2),
                currency VARCHAR(10) DEFAULT 'USD',
                methode VARCHAR(100),
                method VARCHAR(100),
                reference VARCHAR(255),
                transaction_id VARCHAR(255),
                preuve TEXT,
                proof TEXT,
                status VARCHAR(30) DEFAULT 'pending',
                premium_days INTEGER DEFAULT 30,
                notes TEXT,
                refusal_reason TEXT,
                validated_at TIMESTAMPTZ,
                refused_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        await client.query(`
            ALTER TABLE paiements
                ADD COLUMN IF NOT EXISTS user_id INTEGER,
                ADD COLUMN IF NOT EXISTS nom VARCHAR(150),
                ADD COLUMN IF NOT EXISTS email VARCHAR(255),
                ADD COLUMN IF NOT EXISTS telephone VARCHAR(50),
                ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2),
                ADD COLUMN IF NOT EXISTS montant NUMERIC(12,2),
                ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD',
                ADD COLUMN IF NOT EXISTS methode VARCHAR(100),
                ADD COLUMN IF NOT EXISTS method VARCHAR(100),
                ADD COLUMN IF NOT EXISTS reference VARCHAR(255),
                ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255),
                ADD COLUMN IF NOT EXISTS preuve TEXT,
                ADD COLUMN IF NOT EXISTS proof TEXT,
                ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pending',
                ADD COLUMN IF NOT EXISTS premium_days INTEGER DEFAULT 30,
                ADD COLUMN IF NOT EXISTS notes TEXT,
                ADD COLUMN IF NOT EXISTS refusal_reason TEXT,
                ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS refused_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS demandes_paiement (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                telephone_paiement VARCHAR(50) NOT NULL,
                reference_paiement VARCHAR(255) NOT NULL,
                status VARCHAR(30) DEFAULT 'pending',
                refusal_reason TEXT,
                validated_at TIMESTAMPTZ,
                refused_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        await client.query(`
            ALTER TABLE demandes_paiement
                ADD COLUMN IF NOT EXISTS user_id INTEGER,
                ADD COLUMN IF NOT EXISTS telephone_paiement VARCHAR(50),
                ADD COLUMN IF NOT EXISTS reference_paiement VARCHAR(255),
                ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pending',
                ADD COLUMN IF NOT EXISTS refusal_reason TEXT,
                ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS refused_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_activity (
                id SERIAL PRIMARY KEY,
                admin_email VARCHAR(255),
                action VARCHAR(150) NOT NULL,
                details TEXT,
                user_id INTEGER,
                payment_id INTEGER,
                ip VARCHAR(100),
                user_agent TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_email
            ON users(email)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_premium
            ON users(premium, premium_until)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_blocked
            ON users(blocked)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_paiements_status
            ON paiements(status)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_paiements_user
            ON paiements(user_id)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_paiements_created
            ON paiements(created_at DESC)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_demandes_status
            ON demandes_paiement(status)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_demandes_user
            ON demandes_paiement(user_id)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_demandes_created
            ON demandes_paiement(created_at DESC)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_admin_activity_created
            ON admin_activity(created_at DESC)
        `);

        await client.query("COMMIT");

        console.log("✅ Base de données initialisée.");
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ Erreur initialisation DB:", err);
        throw err;
    } finally {
        client.release();
    }
}

/* ============================================================
   ROOT / HEALTH / ROUTES
============================================================ */

app.get("/", (req, res) => {
    return success(res, {
        service: "BMJ SERVICE API",
        status: "online",
        version: "1.0.0",
        environment: NODE_ENV,
        timestamp: new Date().toISOString()
    }, "BMJ SERVICE API fonctionne.");
});

app.get("/api", (req, res) => {
    return success(res, {
        service: "BMJ SERVICE API",
        version: "1.0.0",
        status: "online"
    }, "API BMJ SERVICE disponible.");
});

app.get("/api/health", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW() AS now");

        return success(res, {
            status: "healthy",
            database: "connected",
            server: "online",
            timestamp: result.rows[0].now,
            uptime: process.uptime()
        }, "BMJ SERVICE fonctionne.");
    } catch (err) {
        return error(
            res,
            "Serveur actif mais connexion PostgreSQL impossible.",
            503,
            err.message
        );
    }
});

app.get("/api/test-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW() AS now");
        return success(res, {
            connected: true,
            time: result.rows[0].now
        }, "Connexion PostgreSQL réussie.");
    } catch (err) {
        return error(res, "Connexion PostgreSQL échouée.", 503, err.message);
    }
});

app.get("/api/routes", (req, res) => {
    return success(res, {
        public: [
            "GET /",
            "GET /api",
            "GET /api/health",
            "GET /api/test-db",
            "GET /api/routes",
            "POST /api/inscription",
            "POST /api/register",
            "POST /api/connexion",
            "POST /api/login",
            "GET /api/utilisateurs",
            "GET /api/users",
            "GET /api/utilisateurs/:id",
            "GET /api/users/:id",
            "POST /api/paiements",
            "GET /api/paiements",
            "GET /api/paiements/:id",
            "POST /api/demandes-paiement",
            "GET /api/demandes-paiement",
            "GET /api/demandes-paiement/:id",
            "GET /api/statistiques"
        ],
        admin: [
            "POST /api/admin/login",
            "GET /api/admin/utilisateurs",
            "GET /api/admin/users",
            "POST /api/admin/paiements/manual",
            "GET /api/admin/paiements",
            "GET /api/admin/payments",
            "PATCH /api/admin/paiements/:id/valider",
            "PATCH /api/admin/paiements/:id/refuser",
            "PUT /api/admin/paiements/:id",
            "DELETE /api/admin/paiements/:id",
            "GET /api/admin/demandes-paiement",
            "GET /api/admin/demandes-paiement/:id",
            "PATCH /api/admin/demandes-paiement/:id/valider",
            "PATCH /api/admin/demandes-paiement/:id/refuser",
            "PATCH /api/admin/users/:id/premium",
            "PATCH /api/admin/users/:id/block",
            "GET /api/admin/statistiques",
            "GET /api/admin/journal"
        ]
    }, "Routes disponibles.");
});

/* ============================================================
   ADMIN LOGIN
============================================================ */

app.post("/api/admin/login", async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const password = String(req.body.password || "");

        if (email !== normalizeEmail(ADMIN_EMAIL)) {
            return error(res, "Identifiants administrateur incorrects.", 401);
        }

        if (!safeCompare(password, ADMIN_SECRET)) {
            return error(res, "Identifiants administrateur incorrects.", 401);
        }

        const token = createAdminToken();

        return success(res, {
            token,
            email: ADMIN_EMAIL
        }, "Connexion administrateur réussie.");
    } catch (err) {
        return error(res, "Erreur connexion administrateur.", 500, err.message);
    }
});

/* ============================================================
   AUTHENTIFICATION UTILISATEUR
============================================================ */

async function registerUser(body) {
    const nom = String(body.nom || "").trim();
    const email = normalizeEmail(body.email);
    const telephone = String(body.telephone || "").trim() || null;
    const domaine = String(body.domaine || "").trim() || null;
    const photo = body.photo || null;
    const password = String(body.password || "");

    if (!nom) throw new Error("Le nom est obligatoire.");
    if (!email) throw new Error("L'adresse email est obligatoire.");

    const existing = await pool.query(
        "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
        [email]
    );

    if (existing.rows.length) {
        const err = new Error("Cette adresse email existe déjà.");
        err.code = "EMAIL_EXISTS";
        throw err;
    }

    const hashed = password ? await hashPassword(password) : null;

    const result = await pool.query(
        `INSERT INTO users
            (nom, email, telephone, domaine, password, photo)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, nom, email, telephone, domaine, photo,
                   premium, is_premium, premium_until,
                   blocked, is_blocked, created_at, updated_at`,
        [nom, email, telephone, domaine, hashed, photo]
    );

    return result.rows[0];
}

async function loginUser(body) {
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!email || !password) {
        throw new Error("Email et mot de passe obligatoires.");
    }

    const result = await pool.query(
        "SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
        [email]
    );

    if (!result.rows.length) {
        const err = new Error("Email ou mot de passe incorrect.");
        err.code = "AUTH";
        throw err;
    }

    const user = result.rows[0];

    if (user.blocked || user.is_blocked) {
        const err = new Error("Votre compte est bloqué.");
        err.code = "BLOCKED";
        throw err;
    }

    const valid = await verifyPassword(password, user.password);

    if (!valid) {
        const err = new Error("Email ou mot de passe incorrect.");
        err.code = "AUTH";
        throw err;
    }

    return sanitizeUser(user);
}

app.post(["/api/inscription", "/api/register", "/api/signup"], async (req, res) => {
    try {
        const user = await registerUser(req.body);
        return success(res, sanitizeUser(user), "Compte créé avec succès.", 201);
    } catch (err) {
        if (err.code === "EMAIL_EXISTS") {
            return error(res, err.message, 409);
        }

        return error(res, err.message, 400);
    }
});

app.post(["/api/connexion", "/api/login", "/api/signin"], async (req, res) => {
    try {
        const user = await loginUser(req.body);

        return success(res, {
            user
        }, "Connexion réussie.");
    } catch (err) {
        if (err.code === "BLOCKED") {
            return error(res, err.message, 403);
        }

        return error(res, err.message, 401);
    }
});

/* ============================================================
   UTILISATEURS PUBLICS
============================================================ */

app.get(["/api/utilisateurs", "/api/users"], async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, nom, email, telephone, domaine, photo,
                   premium, is_premium, premium_until,
                   blocked, is_blocked, created_at, updated_at
            FROM users
            ORDER BY created_at DESC
        `);

        return success(
            res,
            result.rows.map(sanitizeUser),
            "Utilisateurs récupérés."
        );
    } catch (err) {
        return error(res, "Impossible de récupérer les utilisateurs.", 500, err.message);
    }
});

app.get(["/api/utilisateurs/:id", "/api/users/:id"], async (req, res) => {
    const id = parseId(req.params.id);

    if (!id) return error(res, "ID utilisateur invalide.", 400);

    try {
        const result = await pool.query(
            `SELECT id, nom, email, telephone, domaine, photo,
                    premium, is_premium, premium_until,
                    blocked, is_blocked, created_at, updated_at
             FROM users
             WHERE id = $1`,
            [id]
        );

        if (!result.rows.length) {
            return error(res, "Utilisateur introuvable.", 404);
        }

        return success(res, sanitizeUser(result.rows[0]), "Utilisateur récupéré.");
    } catch (err) {
        return error(res, "Impossible de récupérer l'utilisateur.", 500, err.message);
    }
});

/* ============================================================
   ADMIN - UTILISATEURS
============================================================ */

app.get(["/api/admin/utilisateurs", "/api/admin/users"], adminAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, nom, email, telephone, domaine, photo,
                   premium, is_premium, premium_until,
                   blocked, is_blocked, created_at, updated_at
            FROM users
            ORDER BY created_at DESC
        `);

        return success(
            res,
            result.rows.map(sanitizeUser),
            "Liste administrateur récupérée."
        );
    } catch (err) {
        return error(res, "Impossible de récupérer les utilisateurs.", 500, err.message);
    }
});

app.post(["/api/admin/utilisateurs", "/api/admin/users"], adminAuth, async (req, res) => {
    try {
        const user = await registerUser(req.body);

        await logActivity(
            "CREATE_USER",
            `Création de l'utilisateur ${user.email}`,
            user.id,
            null,
            req
        );

        return success(res, sanitizeUser(user), "Utilisateur créé.", 201);
    } catch (err) {
        if (err.code === "EMAIL_EXISTS") {
            return error(res, err.message, 409);
        }

        return error(res, err.message, 400);
    }
});

async function updateUser(req, res) {
    const id = parseId(req.params.id);

    if (!id) return error(res, "ID utilisateur invalide.", 400);

    const nom = String(req.body.nom || "").trim() || null;
    const email = req.body.email !== undefined
        ? normalizeEmail(req.body.email)
        : null;
    const telephone = req.body.telephone !== undefined
        ? String(req.body.telephone || "").trim() || null
        : null;
    const domaine = req.body.domaine !== undefined
        ? String(req.body.domaine || "").trim() || null
        : null;
    const photo = req.body.photo !== undefined ? req.body.photo : null;

    try {
        const current = await pool.query(
            "SELECT * FROM users WHERE id = $1",
            [id]
        );

        if (!current.rows.length) {
            return error(res, "Utilisateur introuvable.", 404);
        }

        const user = current.rows[0];

        let passwordHash = user.password;

        if (req.body.password !== undefined && req.body.password !== "") {
            passwordHash = await hashPassword(req.body.password);
        }

        const result = await pool.query(
            `UPDATE users
             SET nom = COALESCE($1, nom),
                 email = COALESCE($2, email),
                 telephone = CASE WHEN $3::text IS NULL THEN telephone ELSE $3 END,
                 domaine = CASE WHEN $4::text IS NULL THEN domaine ELSE $4 END,
                 photo = CASE WHEN $5::text IS NULL THEN photo ELSE $5 END,
                 password = $6,
                 updated_at = NOW()
             WHERE id = $7
             RETURNING id, nom, email, telephone, domaine, photo,
                       premium, is_premium, premium_until,
                       blocked, is_blocked, created_at, updated_at`,
            [nom, email || null, telephone, domaine, photo, passwordHash, id]
        );

        await logActivity(
            "UPDATE_USER",
            `Modification de l'utilisateur ${id}`,
            id,
            null,
            req
        );

        return success(
            res,
            sanitizeUser(result.rows[0]),
            "Utilisateur modifié."
        );
    } catch (err) {
        if (err.code === "23505") {
            return error(res, "Cette adresse email existe déjà.", 409);
        }

        return error(res, "Impossible de modifier l'utilisateur.", 500, err.message);
    }
}

app.put("/api/admin/utilisateurs/:id", adminAuth, updateUser);
app.patch("/api/admin/utilisateurs/:id", adminAuth, updateUser);
app.put("/api/admin/users/:id", adminAuth, updateUser);
app.patch("/api/admin/users/:id", adminAuth, updateUser);

async function deleteUser(req, res) {
    const id = parseId(req.params.id);

    if (!id) return error(res, "ID utilisateur invalide.", 400);

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const current = await client.query(
            "SELECT id, email FROM users WHERE id = $1 FOR UPDATE",
            [id]
        );

        if (!current.rows.length) {
            await client.query("ROLLBACK");
            return error(res, "Utilisateur introuvable.", 404);
        }

        await client.query(
            "UPDATE paiements SET user_id = NULL, updated_at = NOW() WHERE user_id = $1",
            [id]
        );

        await client.query(
            "UPDATE demandes_paiement SET user_id = NULL, updated_at = NOW() WHERE user_id = $1",
            [id]
        );

        await client.query(
            "DELETE FROM users WHERE id = $1",
            [id]
        );

        await client.query("COMMIT");

        await logActivity(
            "DELETE_USER",
            `Suppression de l'utilisateur ${current.rows[0].email}`,
            id,
            null,
            req
        );

        return success(res, { id }, "Utilisateur supprimé.");
    } catch (err) {
        await client.query("ROLLBACK");
        return error(res, "Impossible de supprimer l'utilisateur.", 500, err.message);
    } finally {
        client.release();
    }
}

app.delete("/api/admin/utilisateurs/:id", adminAuth, deleteUser);
app.delete("/api/admin/users/:id", adminAuth, deleteUser);

/* ============================================================
   PAIEMENTS LEGACY
============================================================ */

async function createPayment(req, res) {
    const body = req.body;

    const userId = body.user_id ? parseId(body.user_id) : null;
    const nom = String(body.nom || "").trim() || null;
    const email = normalizeEmail(body.email) || null;
    const telephone = String(body.telephone || "").trim() || null;

    const amount = body.amount !== undefined
        ? Number(body.amount)
        : Number(body.montant);

    const montant = Number.isFinite(amount) ? amount : null;

    const currency = String(body.currency || "USD").trim().toUpperCase();

    const methode = String(
        body.methode || body.method || "Mobile Money"
    ).trim();

    const method = String(
        body.method || body.methode || "Mobile Money"
    ).trim();

    const reference = String(
        body.reference || body.transaction_id || ""
    ).trim() || null;

    const transactionId = String(
        body.transaction_id || body.reference || ""
    ).trim() || null;

    const preuve = body.preuve || body.proof || null;
    const proof = body.proof || body.preuve || null;

    const premiumDaysRaw = Number(body.premium_days || 30);
    const premiumDays = Number.isInteger(premiumDaysRaw) && premiumDaysRaw > 0
        ? Math.min(premiumDaysRaw, 3650)
        : 30;

    const notes = body.notes || null;

    if (userId) {
        const user = await pool.query(
            "SELECT id, blocked, is_blocked FROM users WHERE id = $1",
            [userId]
        );

        if (!user.rows.length) {
            return error(res, "Utilisateur introuvable.", 404);
        }

        if (user.rows[0].blocked || user.rows[0].is_blocked) {
            return error(res, "Ce compte est bloqué.", 403);
        }
    }

    if (montant !== null && montant < 0) {
        return error(res, "Montant invalide.", 400);
    }

    try {
        const result = await pool.query(
            `INSERT INTO paiements
                (user_id, nom, email, telephone, amount, montant,
                 currency, methode, method, reference, transaction_id,
                 preuve, proof, status, premium_days, notes)
             VALUES
                ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',$14,$15)
             RETURNING *`,
            [
                userId,
                nom,
                email,
                telephone,
                montant,
                montant,
                currency,
                methode,
                method,
                reference,
                transactionId,
                preuve,
                proof,
                premiumDays,
                notes
            ]
        );

        return success(
            res,
            result.rows[0],
            "Paiement enregistré. Il est en attente de vérification.",
            201
        );
    } catch (err) {
        return error(res, "Impossible d'enregistrer le paiement.", 500, err.message);
    }
}

app.post("/api/paiements", createPayment);

app.post(
    ["/api/paiements/manual", "/api/admin/paiements/manual"],
    adminAuth,
    async (req, res) => {
        try {
            const result = await createPayment(req, {
                status: (code) => ({
                    json: (payload) => ({ code, payload })
                }),
                json: () => null
            });

            if (result?.payload) {
                return res.status(result.code).json(result.payload);
            }

            return error(res, "Paiement manuel non créé.", 500);
        } catch (err) {
            return error(res, "Erreur paiement manuel.", 500, err.message);
        }
    }
);

/* Version propre de création manuelle admin */
app.post("/api/admin/paiements/manual-v2", adminAuth, async (req, res) => {
    try {
        const fake = await pool.query(
            `INSERT INTO paiements
                (user_id, nom, email, telephone, amount, montant,
                 currency, methode, method, reference, transaction_id,
                 preuve, proof, status, premium_days, notes)
             VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$7,$8,$8,$9,$9,'pending',$10,$11)
             RETURNING *`,
            [
                req.body.user_id ? parseId(req.body.user_id) : null,
                req.body.nom || null,
                normalizeEmail(req.body.email) || null,
                req.body.telephone || null,
                Number(req.body.amount || req.body.montant || 0),
                String(req.body.currency || "USD").toUpperCase(),
                req.body.methode || req.body.method || "Manuel",
                req.body.reference || req.body.transaction_id || null,
                req.body.preuve || req.body.proof || null,
                Number(req.body.premium_days || 30),
                req.body.notes || null
            ]
        );

        await logActivity(
            "CREATE_MANUAL_PAYMENT",
            `Paiement manuel créé: #${fake.rows[0].id}`,
            fake.rows[0].user_id,
            fake.rows[0].id,
            req
        );

        return success(res, fake.rows[0], "Paiement manuel créé.", 201);
    } catch (err) {
        return error(res, "Impossible de créer le paiement manuel.", 500, err.message);
    }
});

async function listPayments(req, res) {
    try {
        const result = await pool.query(`
            SELECT
                p.*,
                u.nom AS user_nom,
                u.email AS user_email,
                u.telephone AS user_telephone,
                u.premium AS user_premium,
                u.premium_until AS user_premium_until
            FROM paiements p
            LEFT JOIN users u ON u.id = p.user_id
            ORDER BY p.created_at DESC
        `);

        return success(res, result.rows, "Paiements récupérés.");
    } catch (err) {
        return error(res, "Impossible de récupérer les paiements.", 500, err.message);
    }
}

app.get("/api/paiements", listPayments);
app.get(["/api/admin/paiements", "/api/admin/payments"], adminAuth, listPayments);

async function getPayment(req, res) {
    const id = parseId(req.params.id);

    if (!id) return error(res, "ID paiement invalide.", 400);

    try {
        const result = await pool.query(
            `SELECT
                p.*,
                u.nom AS user_nom,
                u.email AS user_email,
                u.telephone AS user_telephone
             FROM paiements p
             LEFT JOIN users u ON u.id = p.user_id
             WHERE p.id = $1`,
            [id]
        );

        if (!result.rows.length) {
            return error(res, "Paiement introuvable.", 404);
        }

        return success(res, result.rows[0], "Paiement récupéré.");
    } catch (err) {
        return error(res, "Impossible de récupérer le paiement.", 500, err.message);
    }
}

app.get("/api/paiements/:id", getPayment);

async function activatePremium(client, userId, days = 30) {
    const id = parseId(userId);

    if (!id) {
        throw new Error("ID utilisateur invalide.");
    }

    const userResult = await client.query(
        `SELECT id, premium_until, blocked, is_blocked
         FROM users
         WHERE id = $1
         FOR UPDATE`,
        [id]
    );

    if (!userResult.rows.length) {
        throw new Error("Utilisateur introuvable.");
    }

    const user = userResult.rows[0];

    if (user.blocked || user.is_blocked) {
        throw new Error("Le compte utilisateur est bloqué.");
    }

    const safeDays = Math.min(
        Math.max(Number.parseInt(days, 10) || 30, 1),
        3650
    );

    const baseDate =
        user.premium_until &&
        new Date(user.premium_until).getTime() > Date.now()
            ? new Date(user.premium_until)
            : new Date();

    const premiumUntil = new Date(
        baseDate.getTime() + safeDays * 24 * 60 * 60 * 1000
    );

    const result = await client.query(
        `UPDATE users
         SET premium = TRUE,
             is_premium = TRUE,
             premium_until = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, premium, is_premium, premium_until`,
        [premiumUntil, id]
    );

    return result.rows[0];
}

async function validatePayment(req, res) {
    const id = parseId(req.params.id);

    if (!id) return error(res, "ID paiement invalide.", 400);

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const paymentResult = await client.query(
            `SELECT *
             FROM paiements
             WHERE id = $1
             FOR UPDATE`,
            [id]
        );

        if (!paymentResult.rows.length) {
            await client.query("ROLLBACK");
            return error(res, "Paiement introuvable.", 404);
        }

        const payment = paymentResult.rows[0];

        if (payment.status === "validated") {
            await client.query("ROLLBACK");
            return error(res, "Ce paiement est déjà validé.", 409);
        }

        if (payment.status === "refused") {
            await client.query("ROLLBACK");
            return error(res, "Ce paiement a déjà été refusé.", 409);
        }

        if (!payment.user_id) {
            await client.query("ROLLBACK");
            return error(
                res,
                "Impossible d'activer Premium : aucun utilisateur associé.",
                400
            );
        }

        const premium = await activatePremium(
            client,
            payment.user_id,
            payment.premium_days || 30
        );

        const updated = await client.query(
            `UPDATE paiements
             SET status = 'validated',
                 validated_at = NOW(),
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        await client.query("COMMIT");

        await logActivity(
            "VALIDATE_PAYMENT",
            `Paiement #${id} validé. Premium jusqu'au ${premium.premium_until}`,
            payment.user_id,
            id,
            req
        );

        return success(
            res,
            {
                payment: updated.rows[0],
                premium
            },
            "Paiement validé et Premium activé."
        );
    } catch (err) {
        await client.query("ROLLBACK");
        return error(res, "Impossible de valider le paiement.", 500, err.message);
    } finally {
        client.release();
    }
}

app.patch(
    ["/api/paiements/:id/valider", "/api/admin/paiements/:id/valider"],
    adminAuth,
    validatePayment
);

async function refusePayment(req, res) {
    const id = parseId(req.params.id);

    if (!id) return error(res, "ID paiement invalide.", 400);

    const reason = String(
        req.body.reason ||
        req.body.refusal_reason ||
        "Paiement refusé par l'administration."
    ).trim();

    try {
        const result = await pool.query(
            `UPDATE paiements
             SET status = 'refused',
                 refusal_reason = $1,
                 refused_at = NOW(),
                 updated_at = NOW()
             WHERE id = $2
               AND status = 'pending'
             RETURNING *`,
            [reason, id]
        );

        if (!result.rows.length) {
            const exists = await pool.query(
                "SELECT status FROM paiements WHERE id = $1",
                [id]
            );

            if (!exists.rows.length) {
                return error(res, "Paiement introuvable.", 404);
            }

            return error(
                res,
                `Le paiement n'est pas en attente. Statut actuel: ${exists.rows[0].status}`,
                409
            );
        }

        await logActivity(
            "REFUSE_PAYMENT",
            reason,
            result.rows[0].user_id,
            id,
            req
        );

        return success(res, result.rows[0], "Paiement refusé.");
    } catch (err) {
        return error(res, "Impossible de refuser le paiement.", 500, err.message);
    }
}

app.patch(
    ["/api/paiements/:id/refuser", "/api/admin/paiements/:id/refuser"],
    adminAuth,
    refusePayment
);

async function updatePayment(req, res) {
    const id = parseId(req.params.id);

    if (!id) return error(res, "ID paiement invalide.", 400);

    try {
        const result = await pool.query(
            `UPDATE paiements
             SET amount = COALESCE($1, amount),
                 montant = COALESCE($1, montant),
                 currency = COALESCE($2, currency),
                 methode = COALESCE($3, methode),
                 method = COALESCE($3, method),
                 reference = COALESCE($4, reference),
                 transaction_id = COALESCE($4, transaction_id),
                 notes = COALESCE($5, notes),
                 premium_days = COALESCE($6, premium_days),
                 updated_at = NOW()
             WHERE id = $7
             RETURNING *`,
            [
                req.body.amount !== undefined || req.body.montant !== undefined
                    ? Number(req.body.amount ?? req.body.montant)
                    : null,
                req.body.currency || null,
                req.body.methode || req.body.method || null,
                req.body.reference || req.body.transaction_id || null,
                req.body.notes || null,
                req.body.premium_days
                    ? Number(req.body.premium_days)
                    : null,
                id
            ]
        );

        if (!result.rows.length) {
            return error(res, "Paiement introuvable.", 404);
        }

        await logActivity(
            "UPDATE_PAYMENT",
            `Modification du paiement #${id}`,
            result.rows[0].user_id,
            id,
            req
        );

        return success(res, result.rows[0], "Paiement modifié.");
    } catch (err) {
        return error(res, "Impossible de modifier le paiement.", 500, err.message);
    }
}

app.put("/api/paiements/:id", adminAuth, updatePayment);
app.patch("/api/paiements/:id", adminAuth, updatePayment);
app.put("/api/admin/paiements/:id", adminAuth, updatePayment);
app.patch("/api/admin/paiements/:id", adminAuth, updatePayment);

async function deletePayment(req, res) {
    const id = parseId(req.params.id);

    if (!id) return error(res, "ID paiement invalide.", 400);

    try {
        const result = await pool.query(
            "DELETE FROM paiements WHERE id = $1 RETURNING id, user_id",
            [id]
        );

        if (!result.rows.length) {
            return error(res, "Paiement introuvable.", 404);
        }

        await logActivity(
            "DELETE_PAYMENT",
            `Suppression du paiement #${id}`,
            result.rows[0].user_id,
            id,
            req
        );

        return success(res, { id }, "Paiement supprimé.");
    } catch (err) {
        return error(res, "Impossible de supprimer le paiement.", 500, err.message);
    }
}

app.delete("/api/paiements/:id", adminAuth, deletePayment);
app.delete("/api/admin/paiements/:id", adminAuth, deletePayment);

/* ============================================================
   NOUVEAU SYSTEME : DEMANDES DE PAIEMENT
============================================================ */

app.post("/api/demandes-paiement", async (req, res) => {
    const userId = parseId(req.body.user_id);
    const telephonePaiement = String(
        req.body.telephone_paiement || ""
    ).trim();

    const referencePaiement = String(
        req.body.reference_paiement || ""
    ).trim();

    if (!userId) {
        return error(res, "user_id est obligatoire.", 400);
    }

    if (!telephonePaiement) {
        return error(res, "Le numéro de paiement est obligatoire.", 400);
    }

    if (!referencePaiement) {
        return error(res, "La référence de paiement est obligatoire.", 400);
    }

    try {
        const userResult = await pool.query(
            `SELECT id, nom, email, blocked, is_blocked
             FROM users
             WHERE id = $1`,
            [userId]
        );

        if (!userResult.rows.length) {
            return error(res, "Utilisateur introuvable.", 404);
        }

        const user = userResult.rows[0];

        if (user.blocked || user.is_blocked) {
            return error(res, "Votre compte est bloqué.", 403);
        }

        const duplicatePending = await pool.query(
            `SELECT id
             FROM demandes_paiement
             WHERE user_id = $1
               AND status = 'pending'
             LIMIT 1`,
            [userId]
        );

        if (duplicatePending.rows.length) {
            return error(
                res,
                "Vous avez déjà une demande de paiement en attente.",
                409
            );
        }

        const duplicateReference = await pool.query(
            `SELECT id
             FROM demandes_paiement
             WHERE LOWER(reference_paiement) = LOWER($1)
             LIMIT 1`,
            [referencePaiement]
        );

        if (duplicateReference.rows.length) {
            return error(
                res,
                "Cette référence de paiement a déjà été utilisée.",
                409
            );
        }

        const result = await pool.query(
            `INSERT INTO demandes_paiement
                (user_id, telephone_paiement, reference_paiement, status)
             VALUES ($1,$2,$3,'pending')
             RETURNING *`,
            [
                userId,
                telephonePaiement,
                referencePaiement
            ]
        );

        return success(
            res,
            {
                ...result.rows[0],
                utilisateur: {
                    id: user.id,
                    nom: user.nom,
                    email: user.email
                }
            },
            "Demande de paiement envoyée. Elle sera vérifiée par l'administration.",
            201
        );
    } catch (err) {
        return error(
            res,
            "Impossible d'enregistrer la demande de paiement.",
            500,
            err.message
        );
    }
});

async function listPaymentRequests(req, res) {
    try {
        const result = await pool.query(`
            SELECT
                d.*,
                u.nom AS user_nom,
                u.email AS user_email,
                u.telephone AS user_telephone,
                u.domaine AS user_domaine,
                u.premium AS user_premium,
                u.premium_until AS user_premium_until,
                u.blocked AS user_blocked
            FROM demandes_paiement d
            LEFT JOIN users u ON u.id = d.user_id
            ORDER BY d.created_at DESC
        `);

        return success(
            res,
            result.rows,
            "Demandes de paiement récupérées."
        );
    } catch (err) {
        return error(
            res,
            "Impossible de récupérer les demandes de paiement.",
            500,
            err.message
        );
    }
}

app.get("/api/demandes-paiement", listPaymentRequests);
app.get(
    "/api/admin/demandes-paiement",
    adminAuth,
    listPaymentRequests
);

async function getPaymentRequest(req, res) {
    const id = parseId(req.params.id);

    if (!id) return error(res, "ID demande invalide.", 400);

    try {
        const result = await pool.query(
            `SELECT
                d.*,
                u.nom AS user_nom,
                u.email AS user_email,
                u.telephone AS user_telephone,
                u.domaine AS user_domaine,
                u.premium AS user_premium,
                u.premium_until AS user_premium_until,
                u.blocked AS user_blocked
             FROM demandes_paiement d
             LEFT JOIN users u ON u.id = d.user_id
             WHERE d.id = $1`,
            [id]
        );

        if (!result.rows.length) {
            return error(res, "Demande de paiement introuvable.", 404);
        }

        return success(res, result.rows[0], "Demande récupérée.");
    } catch (err) {
        return error(res, "Impossible de récupérer la demande.", 500, err.message);
    }
}

app.get("/api/demandes-paiement/:id", getPaymentRequest);
app.get(
    "/api/admin/demandes-paiement/:id",
    adminAuth,
    getPaymentRequest
);

async function validatePaymentRequest(req, res) {
    const id = parseId(req.params.id);

    if (!id) return error(res, "ID demande invalide.", 400);

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const requestResult = await client.query(
            `SELECT *
             FROM demandes_paiement
             WHERE id = $1
             FOR UPDATE`,
            [id]
        );

        if (!requestResult.rows.length) {
            await client.query("ROLLBACK");
            return error(res, "Demande de paiement introuvable.", 404);
        }

        const request = requestResult.rows[0];

        if (request.status !== "pending") {
            await client.query("ROLLBACK");
            return error(
                res,
                `Cette demande a déjà été traitée. Statut: ${request.status}`,
                409
            );
        }

        if (!request.user_id) {
            await client.query("ROLLBACK");
            return error(
                res,
                "Cette demande n'est plus associée à un utilisateur.",
                400
            );
        }

        const premium = await activatePremium(
            client,
            request.user_id,
            30
        );

        const updated = await client.query(
            `UPDATE demandes_paiement
             SET status = 'validated',
                 validated_at = NOW(),
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        await client.query("COMMIT");

        await logActivity(
            "VALIDATE_PAYMENT_REQUEST",
            `Demande #${id} validée. Premium jusqu'au ${premium.premium_until}`,
            request.user_id,
            null,
            req
        );

        return success(
            res,
            {
                demande: updated.rows[0],
                premium
            },
            "Demande validée et Premium activé."
        );
    } catch (err) {
        await client.query("ROLLBACK");
        return error(
            res,
            "Impossible de valider la demande.",
            500,
            err.message
        );
    } finally {
        client.release();
    }
}

app.patch(
    "/api/admin/demandes-paiement/:id/valider",
    adminAuth,
    validatePaymentRequest
);

async function refusePaymentRequest(req, res) {
    const id = parseId(req.params.id);

    if (!id) return error(res, "ID demande invalide.", 400);

    const reason = String(
        req.body.reason ||
        req.body.refusal_reason ||
        "Demande refusée par l'administration."
    ).trim();

    try {
        const result = await pool.query(
            `UPDATE demandes_paiement
             SET status = 'refused',
                 refusal_reason = $1,
                 refused_at = NOW(),
                 updated_at = NOW()
             WHERE id = $2
               AND status = 'pending'
             RETURNING *`,
            [reason, id]
        );

        if (!result.rows.length) {
            const exists = await pool.query(
                "SELECT status FROM demandes_paiement WHERE id = $1",
                [id]
            );

            if (!exists.rows.length) {
                return error(res, "Demande introuvable.", 404);
            }

            return error(
                res,
                `Cette demande n'est pas en attente. Statut: ${exists.rows[0].status}`,
                409
            );
        }

        await logActivity(
            "REFUSE_PAYMENT_REQUEST",
            reason,
            result.rows[0].user_id,
            null,
            req
        );

        return success(
            res,
            result.rows[0],
            "Demande de paiement refusée."
        );
    } catch (err) {
        return error(
            res,
            "Impossible de refuser la demande.",
            500,
            err.message
        );
    }
}

app.patch(
    "/api/admin/demandes-paiement/:id/refuser",
    adminAuth,
    refusePaymentRequest
);

/* ============================================================
   GESTION MANUELLE PREMIUM
============================================================ */

async function managePremium(req, res) {
    const id = parseId(req.params.id);

    if (!id) return error(res, "ID utilisateur invalide.", 400);

    const enabled =
        req.body.enabled !== undefined
            ? getBoolean(req.body.enabled)
            : req.body.premium !== undefined
                ? getBoolean(req.body.premium)
                : req.body.is_premium !== undefined
                    ? getBoolean(req.body.is_premium)
                    : true;

    const daysRaw = Number(req.body.days || req.body.premium_days || 30);
    const days = Number.isInteger(daysRaw)
        ? Math.min(Math.max(daysRaw, 1), 3650)
        : 30;

    try {
        if (!enabled) {
            const result = await pool.query(
                `UPDATE users
                 SET premium = FALSE,
                     is_premium = FALSE,
                     premium_until = NULL,
                     updated_at = NOW()
                 WHERE id = $1
                 RETURNING id, premium, is_premium, premium_until`,
                [id]
            );

            if (!result.rows.length) {
                return error(res, "Utilisateur introuvable.", 404);
            }

            await logActivity(
                "DISABLE_PREMIUM",
                `Premium désactivé pour l'utilisateur ${id}`,
                id,
                null,
                req
            );

            return success(
                res,
                result.rows[0],
                "Premium désactivé."
            );
        }

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const premium = await activatePremium(client, id, days);

            await client.query("COMMIT");

            await logActivity(
                "MANUAL_PREMIUM",
                `Premium activé pour ${days} jours.`,
                id,
                null,
                req
            );

            return success(
                res,
                premium,
                `Premium activé pour ${days} jours.`
            );
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        return error(
            res,
            "Impossible de modifier Premium.",
            500,
            err.message
        );
    }
}

app.patch(
    "/api/admin/users/:id/premium",
    adminAuth,
    managePremium
);

app.patch(
    "/api/admin/utilisateurs/:id/premium",
    adminAuth,
    managePremium
);

/* ============================================================
   BLOQUER / DEBLOQUER
============================================================ */

async function blockUser(req, res) {
    const id = parseId(req.params.id);

    if (!id) return error(res, "ID utilisateur invalide.", 400);

    const blocked =
        req.body.blocked !== undefined
            ? getBoolean(req.body.blocked)
            : req.body.is_blocked !== undefined
                ? getBoolean(req.body.is_blocked)
                : true;

    try {
        const result = await pool.query(
            `UPDATE users
             SET blocked = $1,
                 is_blocked = $1,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING id, nom, email, blocked, is_blocked`,
            [blocked, id]
        );

        if (!result.rows.length) {
            return error(res, "Utilisateur introuvable.", 404);
        }

        await logActivity(
            blocked ? "BLOCK_USER" : "UNBLOCK_USER",
            blocked
                ? `Utilisateur ${id} bloqué.`
                : `Utilisateur ${id} débloqué.`,
            id,
            null,
            req
        );

        return success(
            res,
            result.rows[0],
            blocked ? "Utilisateur bloqué." : "Utilisateur débloqué."
        );
    } catch (err) {
        return error(
            res,
            "Impossible de modifier le blocage.",
            500,
            err.message
        );
    }
}

app.patch(
    "/api/admin/users/:id/block",
    adminAuth,
    blockUser
);

app.patch(
    "/api/admin/utilisateurs/:id/block",
    adminAuth,
    blockUser
);

/* ============================================================
   STATISTIQUES
============================================================ */

async function getStatistics(req, res) {
    try {
        const [
            users,
            premium,
            blocked,
            payments,
            paymentStatus,
            requests,
            requestStatus,
            revenue
        ] = await Promise.all([
            pool.query(`SELECT COUNT(*)::int AS count FROM users`),

            pool.query(`
                SELECT COUNT(*)::int AS count
                FROM users
                WHERE (premium = TRUE OR is_premium = TRUE)
                  AND premium_until IS NOT NULL
                  AND premium_until > NOW()
            `),

            pool.query(`
                SELECT COUNT(*)::int AS count
                FROM users
                WHERE blocked = TRUE OR is_blocked = TRUE
            `),

            pool.query(`SELECT COUNT(*)::int AS count FROM paiements`),

            pool.query(`
                SELECT status, COUNT(*)::int AS count
                FROM paiements
                GROUP BY status
                ORDER BY status
            `),

            pool.query(`SELECT COUNT(*)::int AS count FROM demandes_paiement`),

            pool.query(`
                SELECT status, COUNT(*)::int AS count
                FROM demandes_paiement
                GROUP BY status
                ORDER BY status
            `),

            pool.query(`
                SELECT COALESCE(
                    SUM(COALESCE(amount, montant, 0)),
                    0
                )::numeric AS total
                FROM paiements
                WHERE status = 'validated'
            `)
        ]);

        const paymentStats = {};
        for (const row of paymentStatus.rows) {
            paymentStats[row.status] = row.count;
        }

        const requestStats = {};
        for (const row of requestStatus.rows) {
            requestStats[row.status] = row.count;
        }

        return success(res, {
            utilisateurs: users.rows[0].count,
            premium_actifs: premium.rows[0].count,
            utilisateurs_bloques: blocked.rows[0].count,

            paiements: {
                total: payments.rows[0].count,
                pending: paymentStats.pending || 0,
                validated: paymentStats.validated || 0,
                refused: paymentStats.refused || 0
            },

            demandes_paiement: {
                total: requests.rows[0].count,
                pending: requestStats.pending || 0,
                validated: requestStats.validated || 0,
                refused: requestStats.refused || 0
            },

            revenus_valides: Number(revenue.rows[0].total || 0)
        }, "Statistiques récupérées.");
    } catch (err) {
        return error(
            res,
            "Impossible de récupérer les statistiques.",
            500,
            err.message
        );
    }
}

app.get("/api/admin/statistiques", adminAuth, getStatistics);
app.get("/api/statistiques", getStatistics);

/* ============================================================
   JOURNAL ADMIN
============================================================ */

app.get("/api/admin/journal", adminAuth, async (req, res) => {
    try {
        const limitRaw = Number(req.query.limit || 100);
        const limit = Math.min(Math.max(Number.isInteger(limitRaw) ? limitRaw : 100, 1), 500);

        const result = await pool.query(
            `SELECT *
             FROM admin_activity
             ORDER BY created_at DESC
             LIMIT $1`,
            [limit]
        );

        return success(res, result.rows, "Journal administrateur récupéré.");
    } catch (err) {
        return error(res, "Impossible de récupérer le journal.", 500, err.message);
    }
});

/* ============================================================
   404
============================================================ */

app.use((req, res) => {
    return res.status(404).json({
        success: false,
        message: "Route introuvable.",
        method: req.method,
        path: req.originalUrl
    });
});

/* ============================================================
   ERROR HANDLER
============================================================ */

app.use((err, req, res, next) => {
    console.error("❌ Erreur serveur:", err);

    if (res.headersSent) {
        return next(err);
    }

    return error(
        res,
        "Erreur interne du serveur.",
        500,
        err.message
    );
});

/* ============================================================
   SHUTDOWN
============================================================ */

let server = null;
let shuttingDown = false;

async function gracefulShutdown(signal) {
    if (shuttingDown) return;

    shuttingDown = true;

    console.log(`\n🛑 ${signal} reçu. Arrêt du serveur...`);

    try {
        if (server) {
            await new Promise((resolve) => {
                server.close(() => {
                    console.log("✅ Serveur HTTP arrêté.");
                    resolve();
                });
            });
        }

        await pool.end();

        console.log("✅ Pool PostgreSQL fermé.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Erreur pendant l'arrêt:", err);
        process.exit(1);
    }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
    console.error("❌ Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught Exception:", err);
    gracefulShutdown("uncaughtException");
});

/* ============================================================
   START SERVER
============================================================ */

async function startServer() {
    try {
        console.log("========================================");
        console.log("       BMJ SERVICE API");
        console.log("========================================");
        console.log(`Node.js : ${process.version}`);
        console.log(`Environment : ${NODE_ENV}`);
        console.log(`Port : ${PORT}`);

        if (!process.env.DATABASE_URL) {
            throw new Error("DATABASE_URL est obligatoire.");
        }

        await pool.query("SELECT 1");
        console.log("✅ Connexion PostgreSQL réussie.");

        await initializeDatabase();

        server = app.listen(PORT, "0.0.0.0", () => {
            console.log("========================================");
            console.log(`🚀 BMJ SERVICE API démarrée sur ${PORT}`);
            console.log("🌐 Serveur prêt à recevoir les requêtes.");
            console.log("========================================");
        });

        server.on("error", (err) => {
            console.error("❌ Erreur serveur HTTP:", err);
        });
    } catch (err) {
        console.error("========================================");
        console.error("❌ ÉCHEC DU DÉMARRAGE");
        console.error("========================================");
        console.error(err);
        process.exit(1);
    }
}

startServer();
