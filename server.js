// ============================================================
// BMJ SERVICE — SERVEUR COMPLET
// Node.js + Express + PostgreSQL
// Administration complète
// ============================================================

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const crypto = require("crypto");

// ============================================================
// CONFIGURATION
// ============================================================

const app = express();

const PORT = process.env.PORT || 10000;

const DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://name_bmj_db_user:TjgoLRbYV0LizRgBFD1nepGqSqErgBgD@dpg-dagn0e15efls73b8rjh0-a/name_bmj_db";

const ADMIN_EMAIL =
    process.env.ADMIN_EMAIL ||
    "admin@bmjservice.com";

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD ||
    "BMJAdmin@2026";

const ADMIN_SECRET =
    process.env.ADMIN_SECRET ||
    "BMJ_SERVICE_SECRET_2026_CHANGE_ME";

const JUSTIN_NAME = "MUSSIWA JUSTIN";

const JUSTIN_EMAIL =
    "mussiwajustin@gmail.com";

const JUSTIN_PASSWORD =
    process.env.JUSTIN_ADMIN_PASSWORD ||
    "Justin_BMJ_2026!";

// ============================================================
// UTILISATEURS BMJ SERVICE
// ============================================================

const DEMO_USERS = [

    {
        nom: "Jean Patrick Kabeya",
        email: "jean.kabeya@gmail.com",
        telephone: "+243 811 234 501",
        pays: "République Démocratique du Congo",
        ville: "Lubumbashi",
        domaine: "Marketing Digital",
        niveau: "Débutant",
        photo: "https://i.pravatar.cc/300?img=11"
    },

    {
        nom: "Sarah Ilunga",
        email: "sarah.ilunga@gmail.com",
        telephone: "+243 812 345 502",
        pays: "République Démocratique du Congo",
        ville: "Kinshasa",
        domaine: "Leadership",
        niveau: "Intermédiaire",
        photo: "https://i.pravatar.cc/300?img=12"
    },

    {
        nom: "David Mbuyi",
        email: "david.mbuyi@gmail.com",
        telephone: "+243 813 456 503",
        pays: "République Démocratique du Congo",
        ville: "Kolwezi",
        domaine: "Technologie et Industrialisation",
        niveau: "Avancé",
        photo: "https://i.pravatar.cc/300?img=13"
    },

    {
        nom: "Esther Mukendi",
        email: "esther.mukendi@gmail.com",
        telephone: "+243 814 567 504",
        pays: "République Démocratique du Congo",
        ville: "Lubumbashi",
        domaine: "Beauté et Esthétique",
        niveau: "Débutant",
        photo: "https://i.pravatar.cc/300?img=14"
    },

    {
        nom: "Kevin Tshibangu",
        email: "kevin.tshibangu@gmail.com",
        telephone: "+243 815 678 505",
        pays: "République Démocratique du Congo",
        ville: "Goma",
        domaine: "Finance",
        niveau: "Intermédiaire",
        photo: "https://i.pravatar.cc/300?img=15"
    },

    {
        nom: "Grâce Kalume",
        email: "grace.kalume@gmail.com",
        telephone: "+243 816 789 506",
        pays: "République Démocratique du Congo",
        ville: "Bukavu",
        domaine: "Organisation d'Évènements",
        niveau: "Débutant",
        photo: "https://i.pravatar.cc/300?img=16"
    },

    {
        nom: "Patrick Mwamba",
        email: "patrick.mwamba@gmail.com",
        telephone: "+243 817 890 507",
        pays: "République Démocratique du Congo",
        ville: "Kisangani",
        domaine: "Entrepreneuriat",
        niveau: "Avancé",
        photo: "https://i.pravatar.cc/300?img=17"
    },

    {
        nom: "Claudine Banza",
        email: "claudine.banza@gmail.com",
        telephone: "+243 818 901 508",
        pays: "République Démocratique du Congo",
        ville: "Kinshasa",
        domaine: "Marketing Digital",
        niveau: "Intermédiaire",
        photo: "https://i.pravatar.cc/300?img=18"
    },

    {
        nom: "Jonathan Kalenga",
        email: "jonathan.kalenga@gmail.com",
        telephone: "+243 819 012 509",
        pays: "République Démocratique du Congo",
        ville: "Lubumbashi",
        domaine: "Leadership",
        niveau: "Avancé",
        photo: "https://i.pravatar.cc/300?img=19"
    },

    {
        nom: "Naomie Kanku",
        email: "naomie.kanku@gmail.com",
        telephone: "+243 810 123 510",
        pays: "République Démocratique du Congo",
        ville: "Kolwezi",
        domaine: "Beauté et Esthétique",
        niveau: "Intermédiaire",
        photo: "https://i.pravatar.cc/300?img=20"
    },

    {
        nom: "Michel Tshisekedi",
        email: "michel.tshisekedi@gmail.com",
        telephone: "+243 821 234 511",
        pays: "République Démocratique du Congo",
        ville: "Kinshasa",
        domaine: "Technologie et Industrialisation",
        niveau: "Avancé",
        photo: "https://i.pravatar.cc/300?img=21"
    },

    {
        nom: "Aline Kasongo",
        email: "aline.kasongo@gmail.com",
        telephone: "+243 822 345 512",
        pays: "République Démocratique du Congo",
        ville: "Lubumbashi",
        domaine: "Finance",
        niveau: "Débutant",
        photo: "https://i.pravatar.cc/300?img=22"
    },

    {
        nom: "Christian Lunda",
        email: "christian.lunda@gmail.com",
        telephone: "+243 823 456 513",
        pays: "République Démocratique du Congo",
        ville: "Goma",
        domaine: "Entrepreneuriat",
        niveau: "Intermédiaire",
        photo: "https://i.pravatar.cc/300?img=23"
    },

    {
        nom: "Ruth Kabongo",
        email: "ruth.kabongo@gmail.com",
        telephone: "+243 824 567 514",
        pays: "République Démocratique du Congo",
        ville: "Bukavu",
        domaine: "Organisation d'Évènements",
        niveau: "Débutant",
        photo: "https://i.pravatar.cc/300?img=24"
    },

    {
        nom: "Samuel Kabasele",
        email: "samuel.kabasele@gmail.com",
        telephone: "+243 825 678 515",
        pays: "République Démocratique du Congo",
        ville: "Lubumbashi",
        domaine: "Marketing Digital",
        niveau: "Avancé",
        photo: "https://i.pravatar.cc/300?img=25"
    },

    {
        nom: "Diane Mutombo",
        email: "diane.mutombo@gmail.com",
        telephone: "+243 826 789 516",
        pays: "République Démocratique du Congo",
        ville: "Kinshasa",
        domaine: "Leadership",
        niveau: "Intermédiaire",
        photo: "https://i.pravatar.cc/300?img=26"
    },

    {
        nom: "Fabrice Kabila",
        email: "fabrice.kabila@gmail.com",
        telephone: "+243 827 890 517",
        pays: "République Démocratique du Congo",
        ville: "Kolwezi",
        domaine: "Finance",
        niveau: "Débutant",
        photo: "https://i.pravatar.cc/300?img=27"
    },

    {
        nom: "Merveille Lumu",
        email: "merveille.lumu@gmail.com",
        telephone: "+243 828 901 518",
        pays: "République Démocratique du Congo",
        ville: "Lubumbashi",
        domaine: "Beauté et Esthétique",
        niveau: "Avancé",
        photo: "https://i.pravatar.cc/300?img=28"
    },

    {
        nom: "Arnaud Bisimwa",
        email: "arnaud.bisimwa@gmail.com",
        telephone: "+243 829 012 519",
        pays: "République Démocratique du Congo",
        ville: "Goma",
        domaine: "Technologie et Industrialisation",
        niveau: "Intermédiaire",
        photo: "https://i.pravatar.cc/300?img=29"
    },

    {
        nom: "Chantal Ndaya",
        email: "chantal.ndaya@gmail.com",
        telephone: "+243 830 123 520",
        pays: "République Démocratique du Congo",
        ville: "Kinshasa",
        domaine: "Organisation d'Évènements",
        niveau: "Débutant",
        photo: "https://i.pravatar.cc/300?img=30"
    },

    {
        nom: "Daniel Ilunga",
        email: "daniel.ilunga@gmail.com",
        telephone: "+243 831 234 521",
        pays: "République Démocratique du Congo",
        ville: "Lubumbashi",
        domaine: "Entrepreneuriat",
        niveau: "Avancé",
        photo: "https://i.pravatar.cc/300?img=31"
    },

    {
        nom: "Mélissa Kabwe",
        email: "melissa.kabwe@gmail.com",
        telephone: "+243 832 345 522",
        pays: "République Démocratique du Congo",
        ville: "Bukavu",
        domaine: "Marketing Digital",
        niveau: "Intermédiaire",
        photo: "https://i.pravatar.cc/300?img=32"
    },

    {
        nom: "Eric Mungala",
        email: "eric.mungala@gmail.com",
        telephone: "+243 833 456 523",
        pays: "République Démocratique du Congo",
        ville: "Kisangani",
        domaine: "Leadership",
        niveau: "Avancé",
        photo: "https://i.pravatar.cc/300?img=33"
    },

    {
        nom: "Joséphine Kalonji",
        email: "josephine.kalonji@gmail.com",
        telephone: "+243 834 567 524",
        pays: "République Démocratique du Congo",
        ville: "Kolwezi",
        domaine: "Finance",
        niveau: "Débutant",
        photo: "https://i.pravatar.cc/300?img=34"
    },

    {
        nom: "Blaise Mukendi",
        email: "blaise.mukendi@gmail.com",
        telephone: "+243 835 678 525",
        pays: "République Démocratique du Congo",
        ville: "Lubumbashi",
        domaine: "Technologie et Industrialisation",
        niveau: "Intermédiaire",
        photo: "https://i.pravatar.cc/300?img=35"
    },

    {
        nom: "Gloria Tshala",
        email: "gloria.tshala@gmail.com",
        telephone: "+243 836 789 526",
        pays: "République Démocratique du Congo",
        ville: "Kinshasa",
        domaine: "Beauté et Esthétique",
        niveau: "Avancé",
        photo: "https://i.pravatar.cc/300?img=36"
    },

    {
        nom: "Moïse Kanku",
        email: "moise.kanku@gmail.com",
        telephone: "+243 837 890 527",
        pays: "République Démocratique du Congo",
        ville: "Goma",
        domaine: "Entrepreneuriat",
        niveau: "Débutant",
        photo: "https://i.pravatar.cc/300?img=37"
    },

    {
        nom: "Linda Mbuyi",
        email: "linda.mbuyi@gmail.com",
        telephone: "+243 838 901 528",
        pays: "République Démocratique du Congo",
        ville: "Lubumbashi",
        domaine: "Marketing Digital",
        niveau: "Intermédiaire",
        photo: "https://i.pravatar.cc/300?img=38"
    },

    {
        nom: "Robert Kasongo",
        email: "robert.kasongo@gmail.com",
        telephone: "+243 839 012 529",
        pays: "République Démocratique du Congo",
        ville: "Kinshasa",
        domaine: "Leadership",
        niveau: "Avancé",
        photo: "https://i.pravatar.cc/300?img=39"
    },

    {
        nom: "Emmanuelle Banza",
        email: "emmanuelle.banza@gmail.com",
        telephone: "+243 840 123 530",
        pays: "République Démocratique du Congo",
        ville: "Kolwezi",
        domaine: "Organisation d'Évènements",
        niveau: "Débutant",
        photo: "https://i.pravatar.cc/300?img=40"
    }

];

// ============================================================
// POSTGRESQL
// ============================================================

const pool = new Pool({
    connectionString: DATABASE_URL,

    ssl: {
        rejectUnauthorized: false
    },

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000
});

// ============================================================
// MIDDLEWARES
// ============================================================

app.use(
    cors({
        origin: true,
        credentials: false,

        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "Accept",
            "X-Admin-Token"
        ],

        methods: [
            "GET",
            "POST",
            "PATCH",
            "PUT",
            "DELETE",
            "OPTIONS"
        ]
    })
);

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

// ============================================================
// LOGGER
// ============================================================

app.use((req, res, next) => {

    console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`
    );

    next();
});

// ============================================================
// OUTILS
// ============================================================

function normalizeEmail(email) {

    return String(email || "")
        .trim()
        .toLowerCase();
}

function cleanString(value) {

    if (
        value === undefined ||
        value === null
    ) {
        return "";
    }

    return String(value).trim();
}

function parseId(value) {

    const id = Number(value);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        return null;
    }

    return id;
}

function success(
    res,
    data = {},
    message = "Opération réussie."
) {

    return res.json({
        success: true,
        message,
        ...data
    });
}

function failure(
    res,
    status = 400,
    message = "Une erreur est survenue.",
    extra = {}
) {

    return res.status(status).json({
        success: false,
        message,
        ...extra
    });
}

// ============================================================
// PASSWORD
// ============================================================

function hashPassword(password) {

    const salt =
        crypto.randomBytes(16)
            .toString("hex");

    const hash =
        crypto.scryptSync(
            String(password),
            salt,
            64
        ).toString("hex");

    return `scrypt:${salt}:${hash}`;
}

function verifyPassword(
    password,
    storedPassword
) {

    if (!storedPassword) {
        return false;
    }

    const stored =
        String(storedPassword);

    if (!stored.startsWith("scrypt:")) {
        return (
            String(password) === stored
        );
    }

    const parts =
        stored.split(":");

    if (parts.length !== 3) {
        return false;
    }

    try {

        const salt = parts[1];

        const storedHash =
            Buffer.from(
                parts[2],
                "hex"
            );

        const derived =
            crypto.scryptSync(
                String(password),
                salt,
                64
            );

        if (
            derived.length !==
            storedHash.length
        ) {
            return false;
        }

        return crypto.timingSafeEqual(
            derived,
            storedHash
        );

    } catch (error) {

        console.error(
            "Erreur vérification mot de passe:",
            error.message
        );

        return false;
    }
}

// ============================================================
// PREMIUM
// ============================================================

function isPremiumUser(user) {

    if (!user) {
        return false;
    }

    if (
        user.premium === true ||
        user.is_premium === true
    ) {
        return true;
    }

    if (user.premium_until) {

        return (
            new Date(
                user.premium_until
            ) > new Date()
        );
    }

    return false;
}

// ============================================================
// BLOCAGE
// ============================================================

function isBlockedUser(user) {

    if (!user) {
        return false;
    }

    return (
        user.blocked === true ||
        user.is_blocked === true
    );
}

// ============================================================
// TOKEN ADMIN
// ============================================================

function createAdminToken(email) {

    const timestamp =
        Date.now();

    const payload =
        `${normalizeEmail(email)}.${timestamp}`;

    const signature =
        crypto
            .createHmac(
                "sha256",
                ADMIN_SECRET
            )
            .update(payload)
            .digest("hex");

    return Buffer.from(
        `${payload}.${signature}`
    ).toString("base64url");
}

function verifyAdminToken(token) {

    if (!token) {
        return false;
    }

    try {

        const decoded =
            Buffer.from(
                token,
                "base64url"
            ).toString("utf8");

        const parts =
            decoded.split(".");

        if (parts.length !== 3) {
            return false;
        }

        const email = parts[0];

        const timestamp =
            Number(parts[1]);

        const signature =
            parts[2];

        if (
            !email ||
            !timestamp ||
            !signature
        ) {
            return false;
        }

        if (
            Date.now() - timestamp >
            24 * 60 * 60 * 1000
        ) {
            return false;
        }

        const payload =
            `${email}.${timestamp}`;

        const expected =
            crypto
                .createHmac(
                    "sha256",
                    ADMIN_SECRET
                )
                .update(payload)
                .digest("hex");

        const a =
            Buffer.from(signature);

        const b =
            Buffer.from(expected);

        if (a.length !== b.length) {
            return false;
        }

        return crypto.timingSafeEqual(
            a,
            b
        );

    } catch (error) {

        return false;
    }
}

// ============================================================
// AUTH ADMIN
// ============================================================

function adminAuth(
    req,
    res,
    next
) {

    let token = null;

    const auth =
        req.headers.authorization;

    if (
        auth &&
        auth.startsWith("Bearer ")
    ) {

        token =
            auth.substring(7);
    }

    if (!token) {

        token =
            req.headers[
                "x-admin-token"
            ];
    }

    if (!token) {

        token =
            req.query.token;
    }

    if (
        !verifyAdminToken(token)
    ) {

        return failure(
            res,
            401,
            "Accès administrateur refusé."
        );
    }

    next();
}

// ============================================================
// LOG ACTIVITÉ ADMIN
// ============================================================

async function logActivity(
    action,
    details = {},
    userId = null,
    req = null
) {

    try {

        let ip = null;

        if (req) {

            ip =
                req.headers[
                    "x-forwarded-for"
                ] ||
                req.socket?.remoteAddress ||
                null;
        }

        await pool.query(
            `
            INSERT INTO admin_activity
            (
                action,
                details,
                user_id,
                ip
            )
            VALUES
            ($1,$2,$3,$4)
            `,
            [
                cleanString(action),

                typeof details === "string"
                    ? details
                    : JSON.stringify(
                        details || {}
                    ),

                userId,

                ip
            ]
        );

    } catch (error) {

        console.error(
            "Erreur log activité:",
            error.message
        );
    }
}

// ============================================================
// INITIALISATION BASE DE DONNÉES
// ============================================================

async function initDatabase() {

    console.log(
        "🔄 Initialisation PostgreSQL..."
    );

    // ========================================================
    // USERS
    // ========================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (

            id SERIAL PRIMARY KEY,

            nom TEXT NOT NULL,

            email TEXT UNIQUE NOT NULL,

            telephone TEXT,

            domaine TEXT,

            pays TEXT,

            ville TEXT,

            niveau TEXT,

            password TEXT NOT NULL,

            photo TEXT,

            role VARCHAR(20)
                NOT NULL DEFAULT 'user',

            premium BOOLEAN
                DEFAULT FALSE,

            is_premium BOOLEAN
                DEFAULT FALSE,

            premium_until TIMESTAMPTZ,

            blocked BOOLEAN
                DEFAULT FALSE,

            is_blocked BOOLEAN
                DEFAULT FALSE,

            certificate_authorized BOOLEAN
                DEFAULT FALSE,

            certificate_authorized_at
                TIMESTAMPTZ,

            certificate_authorized_by
                TEXT,

            created_at TIMESTAMPTZ
                DEFAULT NOW(),

            updated_at TIMESTAMPTZ
                DEFAULT NOW()
        )
    `);

    // ========================================================
    // COMPATIBILITÉ ANCIENNE BASE
    // ========================================================

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS pays TEXT
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS ville TEXT
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS niveau TEXT
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS certificate_authorized BOOLEAN
        DEFAULT FALSE
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS certificate_authorized_at TIMESTAMPTZ
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS certificate_authorized_by TEXT
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS role VARCHAR(20)
        DEFAULT 'user'
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS premium BOOLEAN
        DEFAULT FALSE
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_premium BOOLEAN
        DEFAULT FALSE
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS blocked BOOLEAN
        DEFAULT FALSE
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN
        DEFAULT FALSE
    `);

    // ========================================================
    // INDEX USERS
    // ========================================================

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_email
        ON users(email)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_premium
        ON users(premium)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_blocked
        ON users(blocked)
    `);

    // ========================================================
    // PAIEMENTS
    // ========================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS paiements (

            id SERIAL PRIMARY KEY,

            user_id INTEGER,

            nom TEXT,

            email TEXT,

            telephone TEXT,

            amount NUMERIC(12,2),

            montant NUMERIC(12,2),

            currency VARCHAR(10)
                DEFAULT 'USD',

            methode TEXT,

            proof TEXT,

            proof_url TEXT,

            proof_type TEXT,

            recipient_number TEXT,

            recipient_name TEXT,

            status VARCHAR(30)
                DEFAULT 'pending',

            premium_days INTEGER
                DEFAULT 30,

            notes TEXT,

            validated_at TIMESTAMPTZ,

            refused_at TIMESTAMPTZ,

            refusal_reason TEXT,

            created_at TIMESTAMPTZ
                DEFAULT NOW(),

            updated_at TIMESTAMPTZ
                DEFAULT NOW()
        )
    `);

    // ========================================================
    // DEMANDES PAIEMENT
    // ========================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS demandes_paiement (

            id SERIAL PRIMARY KEY,

            user_id INTEGER NOT NULL,

            telephone_paiement TEXT,

            reference_paiement TEXT,

            amount NUMERIC(12,2),

            montant NUMERIC(12,2),

            currency VARCHAR(10)
                DEFAULT 'USD',

            methode TEXT,

            proof TEXT,

            recipient_number TEXT,

            recipient_name TEXT,

            status VARCHAR(30)
                DEFAULT 'pending',

            premium_days INTEGER
                DEFAULT 30,

            notes TEXT,

            validated_at TIMESTAMPTZ,

            refused_at TIMESTAMPTZ,

            refusal_reason TEXT,

            created_at TIMESTAMPTZ
                DEFAULT NOW(),

            updated_at TIMESTAMPTZ
                DEFAULT NOW()
        )
    `);

    // ========================================================
    // MESSAGES
    // ========================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (

            id SERIAL PRIMARY KEY,

            sender_type VARCHAR(30)
                DEFAULT 'admin',

            sender_user_id INTEGER,

            sender_name TEXT,

            sender_email TEXT,

            recipient_user_id INTEGER,

            recipient_name TEXT,

            recipient_email TEXT,

            subject TEXT NOT NULL
                DEFAULT 'Message BMJ SERVICE',

            content TEXT NOT NULL,

            type VARCHAR(30) NOT NULL
                DEFAULT 'user',

            priority VARCHAR(20) NOT NULL
                DEFAULT 'normal',

            audience VARCHAR(30) NOT NULL
                DEFAULT 'individual',

            status VARCHAR(30) NOT NULL
                DEFAULT 'unread',

            read_at TIMESTAMPTZ,

            created_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW(),

            updated_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW()
        )
    `);

    // ========================================================
    // PROGRESSION
    // ========================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS course_progress (

            id SERIAL PRIMARY KEY,

            user_id INTEGER NOT NULL,

            domaine TEXT NOT NULL,

            progression INTEGER
                DEFAULT 0,

            lessons_completed INTEGER
                DEFAULT 0,

            total_lessons INTEGER
                DEFAULT 0,

            last_lesson TEXT,

            last_lesson_title TEXT,

            completed BOOLEAN
                DEFAULT FALSE,

            started_at TIMESTAMPTZ
                DEFAULT NOW(),

            completed_at TIMESTAMPTZ,

            updated_at TIMESTAMPTZ
                DEFAULT NOW(),

            UNIQUE(user_id, domaine)
        )
    `);

    // ========================================================
    // ACTIVITÉS ADMIN
    // ========================================================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_activity (

            id SERIAL PRIMARY KEY,

            action TEXT NOT NULL,

            details TEXT,

            user_id INTEGER,

            ip TEXT,

            created_at TIMESTAMPTZ
                DEFAULT NOW()
        )
    `);

    // ========================================================
    // INDEX
    // ========================================================

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_paiements_status
        ON paiements(status)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_paiements_user
        ON paiements(user_id)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_paiements_created
        ON paiements(created_at)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_demandes_status
        ON demandes_paiement(status)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_demandes_user
        ON demandes_paiement(user_id)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_recipient
        ON messages(recipient_user_id)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_created
        ON messages(created_at)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_progress_user
        ON course_progress(user_id)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_progress_domain
        ON course_progress(domaine)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_activity_created
        ON admin_activity(created_at)
    `);

    // ========================================================
    // COMPTE JUSTIN
    // ========================================================

    const existingJustin =
        await pool.query(
            `
            SELECT id
            FROM users
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
            `,
            [JUSTIN_EMAIL]
        );

    if (
        !existingJustin.rows.length
    ) {

        await pool.query(
            `
            INSERT INTO users
            (
                nom,
                email,
                password,
                domaine,
                role,
                premium,
                is_premium,
                blocked,
                is_blocked
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                'admin',
                TRUE,
                TRUE,
                FALSE,
                FALSE
            )
            `,
            [
                JUSTIN_NAME,
                JUSTIN_EMAIL,
                hashPassword(
                    JUSTIN_PASSWORD
                ),
                "Administration"
            ]
        );

        console.log(
            "✅ Compte MUSSIWA JUSTIN créé."
        );

    } else {

        await pool.query(
            `
            UPDATE users
            SET
                nom = $1,
                role = 'admin',
                blocked = FALSE,
                is_blocked = FALSE,
                updated_at = NOW()
            WHERE LOWER(email) = LOWER($2)
            `,
            [
                JUSTIN_NAME,
                JUSTIN_EMAIL
            ]
        );

        console.log(
            "✅ Compte MUSSIWA JUSTIN déjà présent."
        );
    }

    // ========================================================
    // UTILISATEURS BMJ
    // ========================================================

    await seedDemoUsers();

    console.log(
        "✅ Base de données initialisée."
    );
}

// ============================================================
// INSTALLATION UTILISATEURS
// ============================================================

async function seedDemoUsers() {

    console.log(
        "🔄 Synchronisation utilisateurs BMJ..."
    );

    const passwordHash =
        hashPassword(
            "BMJUser@2026"
        );

    for (
        let i = 0;
        i < DEMO_USERS.length;
        i++
    ) {

        const user =
            DEMO_USERS[i];

        const email =
            normalizeEmail(
                user.email
            );

        try {

            const existing =
                await pool.query(
                    `
                    SELECT id
                    FROM users
                    WHERE LOWER(email) = LOWER($1)
                    LIMIT 1
                    `,
                    [email]
                );

            if (
                existing.rows.length
            ) {

                await pool.query(
                    `
                    UPDATE users
                    SET
                        nom = $1,
                        telephone = $2,
                        domaine = $3,
                        pays = $4,
                        ville = $5,
                        niveau = $6,
                        photo = $7,
                        updated_at = NOW()
                    WHERE LOWER(email) = LOWER($8)
                    `,
                    [
                        user.nom,
                        user.telephone,
                        user.domaine,
                        user.pays,
                        user.ville,
                        user.niveau,
                        user.photo,
                        email
                    ]
                );

                continue;
            }

            await pool.query(
                `
                INSERT INTO users
                (
                    nom,
                    email,
                    telephone,
                    domaine,
                    pays,
                    ville,
                    niveau,
                    password,
                    photo,
                    role,
                    premium,
                    is_premium,
                    blocked,
                    is_blocked,
                    certificate_authorized
                )
                VALUES
                (
                    $1,$2,$3,$4,$5,$6,$7,
                    $8,$9,
                    'user',
                    FALSE,
                    FALSE,
                    FALSE,
                    FALSE,
                    FALSE
                )
                `,
                [
                    user.nom,
                    email,
                    user.telephone,
                    user.domaine,
                    user.pays,
                    user.ville,
                    user.niveau,
                    passwordHash,
                    user.photo
                ]
            );

        } catch (error) {

            console.error(
                `Erreur utilisateur ${email}:`,
                error.message
            );
        }
    }

    console.log(
        `✅ ${DEMO_USERS.length} utilisateurs BMJ vérifiés.`
    );
}

// ============================================================
// ROUTE PRINCIPALE
// ============================================================

app.get(
    "/",
    (req, res) => {

        res.json({
            success: true,
            service: "BMJ SERVICE",
            message:
                "Backend BMJ SERVICE fonctionne correctement.",
            version: "2.0.0",
            database: "PostgreSQL",
            administration:
                "active"
        });
    }
);

// ============================================================
// API
// ============================================================

app.get(
    "/api",
    (req, res) => {

        res.json({
            success: true,
            message:
                "BMJ SERVICE API fonctionne.",
            version: "2.0.0"
        });
    }
);

// ============================================================
// HEALTH
// ============================================================

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
                database: "connected",
                service: "BMJ SERVICE"
            });

        } catch (error) {

            return res.status(500)
                .json({
                    success: false,
                    status: "offline",
                    database: "error",
                    error:
                        error.message
                });
        }
    }
);

// ============================================================
// TEST DB
// ============================================================

app.get(
    "/api/test-db",
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    "SELECT NOW() AS now"
                );

            return res.json({
                success: true,
                message:
                    "Connexion PostgreSQL réussie.",
                time:
                    result.rows[0].now
            });

        } catch (error) {

            return res.status(500)
                .json({
                    success: false,
                    message:
                        "Erreur connexion PostgreSQL.",
                    error:
                        error.message
                });
        }
    }
);

// ============================================================
// INSCRIPTION
// ============================================================

async function registerUser(
    req,
    res
) {

    try {

        const {
            nom,
            name,
            email,
            telephone,
            phone,
            domaine,
            pays,
            ville,
            niveau,
            password,
            mot_de_passe,
            photo
        } = req.body;

        const finalName =
            cleanString(
                nom || name
            );

        const finalEmail =
            normalizeEmail(email);

        const finalPhone =
            cleanString(
                telephone || phone
            );

        const finalPassword =
            String(
                password ||
                mot_de_passe ||
                ""
            );

        if (!finalName) {

            return failure(
                res,
                400,
                "Le nom est obligatoire."
            );
        }

        if (!finalEmail) {

            return failure(
                res,
                400,
                "L'adresse email est obligatoire."
            );
        }

        if (!finalPassword) {

            return failure(
                res,
                400,
                "Le mot de passe est obligatoire."
            );
        }

        const existing =
            await pool.query(
                `
                SELECT id
                FROM users
                WHERE LOWER(email) = LOWER($1)
                `,
                [finalEmail]
            );

        if (existing.rows.length) {

            return failure(
                res,
                409,
                "Cette adresse email est déjà utilisée."
            );
        }

        const result =
            await pool.query(
                `
                INSERT INTO users
                (
                    nom,
                    email,
                    telephone,
                    domaine,
                    pays,
                    ville,
                    niveau,
                    password,
                    photo
                )
                VALUES
                ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                RETURNING
                    id,
                    nom,
                    email,
                    telephone,
                    domaine,
                    pays,
                    ville,
                    niveau,
                    photo,
                    role,
                    premium,
                    is_premium,
                    premium_until,
                    blocked,
                    is_blocked,
                    certificate_authorized,
                    created_at
                `,
                [
                    finalName,
                    finalEmail,
                    finalPhone,
                    cleanString(domaine),
                    cleanString(pays),
                    cleanString(ville),
                    cleanString(niveau),
                    hashPassword(
                        finalPassword
                    ),
                    photo || null
                ]
            );

        return success(
            res,
            {
                user:
                    result.rows[0]
            },
            "Inscription réussie."
        );

    } catch (error) {

        console.error(
            "Erreur inscription:",
            error
        );

        return failure(
            res,
            500,
            "Erreur lors de l'inscription.",
            {
                error:
                    error.message
            }
        );
    }
}

app.post(
    "/api/inscription",
    registerUser
);

app.post(
    "/api/register",
    registerUser
);

app.post(
    "/api/signup",
    registerUser
);

// ============================================================
// CONNEXION
// ============================================================

async function loginUser(
    req,
    res
) {

    try {

        const {
            email,
            password,
            mot_de_passe
        } = req.body;

        const finalEmail =
            normalizeEmail(email);

        const finalPassword =
            String(
                password ||
                mot_de_passe ||
                ""
            );

        if (
            !finalEmail ||
            !finalPassword
        ) {

            return failure(
                res,
                400,
                "Email et mot de passe obligatoires."
            );
        }

        const result =
            await pool.query(
                `
                SELECT *
                FROM users
                WHERE LOWER(email) = LOWER($1)
                LIMIT 1
                `,
                [finalEmail]
            );

        if (!result.rows.length) {

            return failure(
                res,
                401,
                "Email ou mot de passe incorrect."
            );
        }

        const user =
            result.rows[0];

        if (
            !verifyPassword(
                finalPassword,
                user.password
            )
        ) {

            return failure(
                res,
                401,
                "Email ou mot de passe incorrect."
            );
        }

        if (
            isBlockedUser(user)
        ) {

            return failure(
                res,
                403,
                "Ce compte est bloqué."
            );
        }

        const premium =
            isPremiumUser(user);

        return success(
            res,
            {
                user: {

                    id: user.id,

                    nom: user.nom,

                    email: user.email,

                    telephone:
                        user.telephone,

                    domaine:
                        user.domaine,

                    pays:
                        user.pays,

                    ville:
                        user.ville,

                    niveau:
                        user.niveau,

                    photo:
                        user.photo,

                    role:
                        user.role,

                    premium,

                    is_premium:
                        premium,

                    premium_until:
                        user.premium_until,

                    blocked: false,

                    is_blocked: false,

                    certificate_authorized:
                        user.certificate_authorized === true
                }
            },
            "Connexion réussie."
        );

    } catch (error) {

        console.error(
            "Erreur connexion:",
            error
        );

        return failure(
            res,
            500,
            "Erreur lors de la connexion.",
            {
                error:
                    error.message
            }
        );
    }
}

app.post(
    "/api/connexion",
    loginUser
);

app.post(
    "/api/login",
    loginUser
);

app.post(
    "/api/signin",
    loginUser
);

// ============================================================
// CONNEXION ADMIN
// ============================================================

app.post(
    "/api/admin/login",
    async (req, res) => {

        try {

            const {
                email,
                password,
                mot_de_passe
            } = req.body;

            const finalEmail =
                normalizeEmail(email);

            const finalPassword =
                String(
                    password ||
                    mot_de_passe ||
                    ""
                );

            if (
                !finalEmail ||
                !finalPassword
            ) {

                return failure(
                    res,
                    400,
                    "Email et mot de passe obligatoires."
                );
            }

            // ADMIN PRINCIPAL

            if (
                finalEmail ===
                    normalizeEmail(
                        ADMIN_EMAIL
                    ) &&
                finalPassword ===
                    ADMIN_PASSWORD
            ) {

                const token =
                    createAdminToken(
                        finalEmail
                    );

                await logActivity(
                    "ADMIN_LOGIN",
                    {
                        email:
                            finalEmail
                    }
                );

                return success(
                    res,
                    {
                        token,

                        admin: {
                            email:
                                finalEmail,
                            role:
                                "admin"
                        }
                    },
                    "Connexion administrateur réussie."
                );
            }

            // JUSTIN

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM users
                    WHERE LOWER(email) = LOWER($1)
                    AND role = 'admin'
                    LIMIT 1
                    `,
                    [finalEmail]
                );

            if (!result.rows.length) {

                return failure(
                    res,
                    401,
                    "Identifiants administrateur incorrects."
                );
            }

            const user =
                result.rows[0];

            if (
                !verifyPassword(
                    finalPassword,
                    user.password
                )
            ) {

                return failure(
                    res,
                    401,
                    "Identifiants administrateur incorrects."
                );
            }

            const token =
                createAdminToken(
                    user.email
                );

            await logActivity(
                "ADMIN_LOGIN",
                {
                    email:
                        user.email,
                    user_id:
                        user.id
                },
                user.id
            );

            return success(
                res,
                {
                    token,

                    admin: {
                        id:
                            user.id,

                        nom:
                            user.nom,

                        email:
                            user.email,

                        role:
                            "admin"
                    }
                },
                "Connexion administrateur réussie."
            );

        } catch (error) {

            console.error(
                "Erreur admin login:",
                error
            );

            return failure(
                res,
                500,
                "Erreur connexion administrateur.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// UTILISATEUR PAR ID
// ============================================================

app.get(
    "/api/utilisateurs/:id",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                parseId(
                    req.params.id
                );

            if (!id) {

                return failure(
                    res,
                    400,
                    "ID utilisateur invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        nom,
                        email,
                        telephone,
                        domaine,
                        pays,
                        ville,
                        niveau,
                        photo,
                        role,
                        premium,
                        is_premium,
                        premium_until,
                        blocked,
                        is_blocked,
                        certificate_authorized,
                        certificate_authorized_at,
                        certificate_authorized_by,
                        created_at,
                        updated_at
                    FROM users
                    WHERE id = $1
                    `,
                    [id]
                );

            if (!result.rows.length) {

                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            const user =
                result.rows[0];

            user.premium =
                isPremiumUser(user);

            user.is_premium =
                user.premium;

            user.blocked =
                isBlockedUser(user);

            user.is_blocked =
                user.blocked;

            return success(
                res,
                {
                    user
                }
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur récupération utilisateur.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// LISTE UTILISATEURS
// ============================================================

async function getUsers(
    req,
    res
) {

    try {

        const result =
            await pool.query(
                `
                SELECT
                    id,
                    nom,
                    email,
                    telephone,
                    domaine,
                    pays,
                    ville,
                    niveau,
                    photo,
                    role,
                    premium,
                    is_premium,
                    premium_until,
                    blocked,
                    is_blocked,
                    certificate_authorized,
                    certificate_authorized_at,
                    certificate_authorized_by,
                    created_at,
                    updated_at
                FROM users
                ORDER BY id DESC
                `
            );

        const users =
            result.rows.map(
                user => {

                    const premium =
                        isPremiumUser(
                            user
                        );

                    const blocked =
                        isBlockedUser(
                            user
                        );

                    return {

                        ...user,

                        premium,

                        is_premium:
                            premium,

                        blocked,

                        is_blocked:
                            blocked
                    };
                }
            );

        return success(
            res,
            {
                utilisateurs:
                    users,

                users,

                apprenants:
                    users,

                total:
                    users.length
            }
        );

    } catch (error) {

        return failure(
            res,
            500,
            "Erreur récupération utilisateurs.",
            {
                error:
                    error.message
            }
        );
    }
}

app.get(
    "/api/utilisateurs",
    adminAuth,
    getUsers
);

app.get(
    "/api/admin/utilisateurs",
    adminAuth,
    getUsers
);

app.get(
    "/api/apprenants",
    adminAuth,
    getUsers
);

// ============================================================
// MODIFIER UTILISATEUR
// ============================================================

app.patch(
    "/api/admin/users/:id",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                parseId(
                    req.params.id
                );

            if (!id) {

                return failure(
                    res,
                    400,
                    "ID utilisateur invalide."
                );
            }

            const {
                nom,
                email,
                telephone,
                domaine,
                pays,
                ville,
                niveau,
                photo,
                password
            } = req.body || {};

            const existing =
                await pool.query(
                    `
                    SELECT *
                    FROM users
                    WHERE id = $1
                    `,
                    [id]
                );

            if (!existing.rows.length) {

                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            const current =
                existing.rows[0];

            const finalEmail =
                email !== undefined
                    ? normalizeEmail(email)
                    : current.email;

            if (!finalEmail) {

                return failure(
                    res,
                    400,
                    "Email obligatoire."
                );
            }

            const duplicate =
                await pool.query(
                    `
                    SELECT id
                    FROM users
                    WHERE LOWER(email) = LOWER($1)
                    AND id <> $2
                    LIMIT 1
                    `,
                    [
                        finalEmail,
                        id
                    ]
                );

            if (
                duplicate.rows.length
            ) {

                return failure(
                    res,
                    409,
                    "Cette adresse email est déjà utilisée."
                );
            }

            let finalPassword =
                current.password;

            if (
                password !== undefined &&
                cleanString(password)
            ) {

                finalPassword =
                    hashPassword(
                        password
                    );
            }

            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET

                        nom = $1,

                        email = $2,

                        telephone = $3,

                        domaine = $4,

                        pays = $5,

                        ville = $6,

                        niveau = $7,

                        photo = $8,

                        password = $9,

                        updated_at = NOW()

                    WHERE id = $10

                    RETURNING
                        id,
                        nom,
                        email,
                        telephone,
                        domaine,
                        pays,
                        ville,
                        niveau,
                        photo,
                        role,
                        premium,
                        is_premium,
                        premium_until,
                        blocked,
                        is_blocked,
                        certificate_authorized,
                        certificate_authorized_at,
                        certificate_authorized_by,
                        created_at,
                        updated_at
                    `,
                    [

                        cleanString(
                            nom !== undefined
                                ? nom
                                : current.nom
                        ),

                        finalEmail,

                        cleanString(
                            telephone !== undefined
                                ? telephone
                                : current.telephone
                        ),

                        cleanString(
                            domaine !== undefined
                                ? domaine
                                : current.domaine
                        ),

                        cleanString(
                            pays !== undefined
                                ? pays
                                : current.pays
                        ),

                        cleanString(
                            ville !== undefined
                                ? ville
                                : current.ville
                        ),

                        cleanString(
                            niveau !== undefined
                                ? niveau
                                : current.niveau
                        ),

                        photo !== undefined
                            ? photo
                            : current.photo,

                        finalPassword,

                        id
                    ]
                );

            const updated =
                result.rows[0];

            updated.premium =
                isPremiumUser(updated);

            updated.is_premium =
                updated.premium;

            updated.blocked =
                isBlockedUser(updated);

            updated.is_blocked =
                updated.blocked;

            await logActivity(
                "UPDATE_USER",
                {
                    user_id:
                        id,
                    email:
                        updated.email
                },
                id,
                req
            );

            return success(
                res,
                {
                    user:
                        updated
                },
                "Utilisateur modifié avec succès."
            );

        } catch (error) {

            console.error(
                "Erreur modification utilisateur:",
                error
            );

            return failure(
                res,
                500,
                "Erreur modification utilisateur.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// PREMIUM
// ============================================================

app.patch(
    "/api/admin/users/:id/premium",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                parseId(
                    req.params.id
                );

            if (!id) {

                return failure(
                    res,
                    400,
                    "ID utilisateur invalide."
                );
            }

            const days =
                Number(
                    req.body.days ||
                    req.body.premium_days ||
                    30
                );

            if (
                !Number.isInteger(days) ||
                days <= 0 ||
                days > 3650
            ) {

                return failure(
                    res,
                    400,
                    "Durée Premium invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM users
                    WHERE id = $1
                    `,
                    [id]
                );

            if (!result.rows.length) {

                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            const user =
                result.rows[0];

            const now =
                new Date();

            let baseDate =
                now;

            if (
                user.premium_until &&
                new Date(
                    user.premium_until
                ) > now
            ) {

                baseDate =
                    new Date(
                        user.premium_until
                    );
            }

            const premiumUntil =
                new Date(
                    baseDate.getTime() +
                    days *
                    24 *
                    60 *
                    60 *
                    1000
                );

            const updated =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        premium = TRUE,
                        is_premium = TRUE,
                        premium_until = $1,
                        updated_at = NOW()
                    WHERE id = $2
                    RETURNING *
                    `,
                    [
                        premiumUntil,
                        id
                    ]
                );

            await logActivity(
                "SET_PREMIUM",
                {
                    user_id:
                        id,
                    days,
                    premium_until:
                        premiumUntil
                },
                id,
                req
            );

            return success(
                res,
                {
                    user:
                        updated.rows[0],

                    premium:
                        true,

                    is_premium:
                        true,

                    premium_until:
                        premiumUntil
                },
                `Premium activé pour ${days} jours.`
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur activation Premium.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// STANDARD
// ============================================================

app.patch(
    "/api/admin/users/:id/standard",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                parseId(
                    req.params.id
                );

            if (!id) {

                return failure(
                    res,
                    400,
                    "ID utilisateur invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        premium = FALSE,
                        is_premium = FALSE,
                        premium_until = NULL,
                        updated_at = NOW()
                    WHERE id = $1
                    RETURNING *
                    `,
                    [id]
                );

            if (!result.rows.length) {

                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            await logActivity(
                "SET_STANDARD",
                {
                    user_id:
                        id
                },
                id,
                req
            );

            return success(
                res,
                {
                    user:
                        result.rows[0],

                    premium:
                        false,

                    is_premium:
                        false
                },
                "Utilisateur passé en Standard."
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur passage Standard.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// PREMIUM COMPATIBILITÉ
// ============================================================

app.patch(
    "/api/admin/users/:id/premium-status",
    adminAuth,
    async (req, res) => {

        const enabled =
            req.body.enabled === true ||
            req.body.enabled === 1 ||
            req.body.enabled === "1" ||
            req.body.enabled === "true";

        if (!enabled) {

            req.url =
                `/api/admin/users/${req.params.id}/standard`;
        }

        return failure(
            res,
            404,
            enabled
                ? "Utilisez /api/admin/users/:id/premium."
                : "Utilisez /api/admin/users/:id/standard."
        );
    }
);

// ============================================================
// BLOQUER
// ============================================================

app.patch(
    "/api/admin/users/:id/block",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                parseId(
                    req.params.id
                );

            if (!id) {

                return failure(
                    res,
                    400,
                    "ID utilisateur invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        blocked = TRUE,
                        is_blocked = TRUE,
                        updated_at = NOW()
                    WHERE id = $1
                    RETURNING *
                    `,
                    [id]
                );

            if (!result.rows.length) {

                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            await logActivity(
                "BLOCK_USER",
                {
                    user_id:
                        id
                },
                id,
                req
            );

            return success(
                res,
                {
                    user:
                        result.rows[0],

                    blocked:
                        true,

                    is_blocked:
                        true
                },
                "Utilisateur bloqué."
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur blocage utilisateur.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// DÉBLOQUER
// ============================================================

app.patch(
    "/api/admin/users/:id/unblock",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                parseId(
                    req.params.id
                );

            if (!id) {

                return failure(
                    res,
                    400,
                    "ID utilisateur invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        blocked = FALSE,
                        is_blocked = FALSE,
                        updated_at = NOW()
                    WHERE id = $1
                    RETURNING *
                    `,
                    [id]
                );

            if (!result.rows.length) {

                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            await logActivity(
                "UNBLOCK_USER",
                {
                    user_id:
                        id
                },
                id,
                req
            );

            return success(
                res,
                {
                    user:
                        result.rows[0],

                    blocked:
                        false,

                    is_blocked:
                        false
                },
                "Utilisateur débloqué."
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur déblocage utilisateur.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// ROUTE BLOCAGE COMPATIBILITÉ
// ============================================================

app.patch(
    "/api/admin/utilisateurs/:id/blocage",
    adminAuth,
    async (req, res) => {

        const blocked =
            req.body.blocked === true ||
            req.body.blocked === 1 ||
            req.body.blocked === "1" ||
            req.body.blocked === "true";

        if (blocked) {

            return res.redirect(
                307,
                `/api/admin/users/${req.params.id}/block`
            );
        }

        return res.redirect(
            307,
            `/api/admin/users/${req.params.id}/unblock`
        );
    }
);

// ============================================================
// CERTIFICAT
// ============================================================

app.patch(
    "/api/admin/users/:id/certificate",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                parseId(
                    req.params.id
                );

            if (!id) {

                return failure(
                    res,
                    400,
                    "ID utilisateur invalide."
                );
            }

            const authorized =
                req.body.authorized === true ||
                req.body.authorized === 1 ||
                req.body.authorized === "1" ||
                req.body.authorized === "true";

            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        certificate_authorized = $1,

                        certificate_authorized_at =
                            CASE
                                WHEN $1 = TRUE
                                THEN NOW()
                                ELSE NULL
                            END,

                        certificate_authorized_by =
                            CASE
                                WHEN $1 = TRUE
                                THEN $2
                                ELSE NULL
                            END,

                        updated_at = NOW()

                    WHERE id = $3

                    RETURNING
                        id,
                        nom,
                        email,
                        certificate_authorized,
                        certificate_authorized_at,
                        certificate_authorized_by
                    `,
                    [
                        authorized,
                        ADMIN_EMAIL,
                        id
                    ]
                );

            if (!result.rows.length) {

                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            await logActivity(
                authorized
                    ? "AUTHORIZE_CERTIFICATE"
                    : "REVOKE_CERTIFICATE",
                {
                    user_id:
                        id,
                    authorized
                },
                id,
                req
            );

            return success(
                res,
                {
                    user:
                        result.rows[0],

                    certificate_authorized:
                        authorized
                },
                authorized
                    ? "Téléchargement du certificat autorisé."
                    : "Autorisation du certificat retirée."
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur autorisation certificat.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// VÉRIFIER CERTIFICAT UTILISATEUR
// ============================================================

app.get(
    "/api/users/:id/certificate-access",
    async (req, res) => {

        try {

            const id =
                parseId(
                    req.params.id
                );

            if (!id) {

                return failure(
                    res,
                    400,
                    "ID utilisateur invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        nom,
                        email,
                        premium,
                        is_premium,
                        premium_until,
                        certificate_authorized
                    FROM users
                    WHERE id = $1
                    `,
                    [id]
                );

            if (!result.rows.length) {

                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            const user =
                result.rows[0];

            return success(
                res,
                {
                    authorized:
                        user.certificate_authorized === true,

                    premium:
                        isPremiumUser(user),

                    user
                }
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur vérification certificat.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// PAIEMENT — CRÉATION
// ============================================================

async function createPayment(
    req,
    res
) {

    try {

        const {
            user_id,
            nom,
            email,
            telephone,
            amount,
            montant,
            currency,
            methode,
            proof,
            proof_url,
            proof_type,
            recipient_number,
            recipient_name,
            premium_days,
            notes
        } = req.body;

        const userId =
            user_id
                ? parseId(user_id)
                : null;

        const finalAmount =
            Number(
                amount !== undefined
                    ? amount
                    : montant
            );

        if (
            !Number.isFinite(
                finalAmount
            ) ||
            finalAmount <= 0
        ) {

            return failure(
                res,
                400,
                "Montant de paiement invalide."
            );
        }

        const result =
            await pool.query(
                `
                INSERT INTO paiements
                (
                    user_id,
                    nom,
                    email,
                    telephone,
                    amount,
                    montant,
                    currency,
                    methode,
                    proof,
                    proof_url,
                    proof_type,
                    recipient_number,
                    recipient_name,
                    status,
                    premium_days,
                    notes
                )
                VALUES
                (
                    $1,$2,$3,$4,$5,$5,
                    $6,$7,$8,$9,$10,
                    $11,$12,'pending',$13,$14
                )
                RETURNING *
                `,
                [
                    userId,
                    cleanString(nom),
                    normalizeEmail(email),
                    cleanString(telephone),
                    finalAmount,
                    cleanString(
                        currency || "USD"
                    ),
                    cleanString(methode),
                    proof || null,
                    proof_url || null,
                    proof_type || null,
                    cleanString(
                        recipient_number
                    ),
                    cleanString(
                        recipient_name
                    ),
                    Number(
                        premium_days || 30
                    ),
                    cleanString(notes)
                ]
            );

        return success(
            res,
            {
                paiement:
                    result.rows[0]
            },
            "Paiement envoyé."
        );

    } catch (error) {

        return failure(
            res,
            500,
            "Erreur enregistrement paiement.",
            {
                error:
                    error.message
            }
        );
    }
}

app.post(
    "/api/paiements",
    createPayment
);

app.post(
    "/api/paiements/manual",
    createPayment
);

// ============================================================
// LISTE PAIEMENTS
// ============================================================

async function getPayments(
    req,
    res
) {

    try {

        const result =
            await pool.query(
                `
                SELECT
                    p.*,

                    u.nom AS user_nom,

                    u.email AS user_email,

                    u.telephone AS user_telephone,

                    u.domaine AS user_domaine,

                    u.premium AS user_premium,

                    u.is_premium AS user_is_premium

                FROM paiements p

                LEFT JOIN users u
                    ON u.id = p.user_id

                ORDER BY p.id DESC
                `
            );

        return success(
            res,
            {
                paiements:
                    result.rows,

                payments:
                    result.rows,

                total:
                    result.rows.length
            }
        );

    } catch (error) {

        return failure(
            res,
            500,
            "Erreur récupération paiements.",
            {
                error:
                    error.message
            }
        );
    }
}

app.get(
    "/api/paiements",
    adminAuth,
    getPayments
);

app.get(
    "/api/admin/paiements",
    adminAuth,
    getPayments
);

// ============================================================
// PAIEMENT PAR ID
// ============================================================

app.get(
    "/api/paiements/:id",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                parseId(
                    req.params.id
                );

            if (!id) {

                return failure(
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

                        u.nom AS user_nom,

                        u.email AS user_email,

                        u.telephone AS user_telephone,

                        u.domaine AS user_domaine

                    FROM paiements p

                    LEFT JOIN users u
                        ON u.id = p.user_id

                    WHERE p.id = $1
                    `,
                    [id]
                );

            if (!result.rows.length) {

                return failure(
                    res,
                    404,
                    "Paiement introuvable."
                );
            }

            return success(
                res,
                {
                    paiement:
                        result.rows[0]
                }
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur récupération paiement.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// VALIDER PAIEMENT
// ============================================================

app.patch(
    "/api/paiements/:id/valider",
    adminAuth,
    async (req, res) => {

        const client =
            await pool.connect();

        try {

            const id =
                parseId(
                    req.params.id
                );

            if (!id) {

                return failure(
                    res,
                    400,
                    "ID paiement invalide."
                );
            }

            await client.query(
                "BEGIN"
            );

            const payment =
                await client.query(
                    `
                    SELECT *
                    FROM paiements
                    WHERE id = $1
                    FOR UPDATE
                    `,
                    [id]
                );

            if (!payment.rows.length) {

                await client.query(
                    "ROLLBACK"
                );

                return failure(
                    res,
                    404,
                    "Paiement introuvable."
                );
            }

            const paiement =
                payment.rows[0];

            if (
                paiement.status ===
                "validated"
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return failure(
                    res,
                    409,
                    "Paiement déjà validé."
                );
            }

            if (
                paiement.status ===
                "refused"
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return failure(
                    res,
                    409,
                    "Paiement déjà refusé."
                );
            }

            const userId =
                paiement.user_id;

            if (!userId) {

                await client.query(
                    "ROLLBACK"
                );

                return failure(
                    res,
                    400,
                    "Paiement non associé à un utilisateur."
                );
            }

            const user =
                await client.query(
                    `
                    SELECT *
                    FROM users
                    WHERE id = $1
                    FOR UPDATE
                    `,
                    [userId]
                );

            if (!user.rows.length) {

                await client.query(
                    "ROLLBACK"
                );

                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            const days =
                Number(
                    paiement.premium_days ||
                    30
                );

            const now =
                new Date();

            let baseDate =
                now;

            if (
                user.rows[0]
                    .premium_until &&
                new Date(
                    user.rows[0]
                        .premium_until
                ) > now
            ) {

                baseDate =
                    new Date(
                        user.rows[0]
                            .premium_until
                    );
            }

            const premiumUntil =
                new Date(
                    baseDate.getTime() +
                    days *
                    24 *
                    60 *
                    60 *
                    1000
                );

            await client.query(
                `
                UPDATE users
                SET
                    premium = TRUE,
                    is_premium = TRUE,
                    premium_until = $1,
                    updated_at = NOW()
                WHERE id = $2
                `,
                [
                    premiumUntil,
                    userId
                ]
            );

            const updated =
                await client.query(
                    `
                    UPDATE paiements
                    SET
                        status = 'validated',
                        validated_at = NOW(),
                        updated_at = NOW()
                    WHERE id = $1
                    RETURNING *
                    `,
                    [id]
                );

            await client.query(
                "COMMIT"
            );

            await logActivity(
                "VALIDATE_PAYMENT",
                {
                    paiement_id:
                        id,
                    user_id:
                        userId,
                    premium_days:
                        days
                },
                userId,
                req
            );

            return success(
                res,
                {
                    paiement:
                        updated.rows[0],

                    user_id:
                        userId,

                    premium:
                        true,

                    is_premium:
                        true,

                    premium_until:
                        premiumUntil,

                    premium_days:
                        days
                },
                "Paiement validé. Premium activé."
            );

        } catch (error) {

            try {
                await client.query(
                    "ROLLBACK"
                );
            } catch (_) {}

            console.error(
                "Erreur validation paiement:",
                error
            );

            return failure(
                res,
                500,
                "Erreur validation paiement.",
                {
                    error:
                        error.message
                }
            );

        } finally {

            client.release();
        }
    }
);

// ============================================================
// REFUSER PAIEMENT
// ============================================================

app.patch(
    "/api/paiements/:id/refuser",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                parseId(
                    req.params.id
                );

            const reason =
                cleanString(
                    req.body.reason ||
                    req.body.motif ||
                    req.body.refusal_reason ||
                    "Paiement refusé."
                );

            if (!id) {

                return failure(
                    res,
                    400,
                    "ID paiement invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    UPDATE paiements
                    SET
                        status = 'refused',

                        refused_at = NOW(),

                        refusal_reason = $1,

                        updated_at = NOW()

                    WHERE id = $2

                    AND status <> 'validated'

                    RETURNING *
                    `,
                    [
                        reason,
                        id
                    ]
                );

            if (!result.rows.length) {

                const check =
                    await pool.query(
                        `
                        SELECT status
                        FROM paiements
                        WHERE id = $1
                        `,
                        [id]
                    );

                if (!check.rows.length) {

                    return failure(
                        res,
                        404,
                        "Paiement introuvable."
                    );
                }

                return failure(
                    res,
                    409,
                    "Impossible de refuser ce paiement."
                );
            }

            await logActivity(
                "REFUSE_PAYMENT",
                {
                    paiement_id:
                        id,
                    reason
                },
                null,
                req
            );

            return success(
                res,
                {
                    paiement:
                        result.rows[0]
                },
                "Paiement refusé."
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur refus paiement.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// DEMANDES PAIEMENT
// ============================================================

app.post(
    "/api/demandes-paiement",
    async (req, res) => {

        try {

            const {
                user_id,
                telephone_paiement,
                reference_paiement,
                amount,
                montant,
                currency,
                methode,
                proof,
                recipient_number,
                recipient_name,
                premium_days,
                notes
            } = req.body;

            const userId =
                parseId(user_id);

            if (!userId) {

                return failure(
                    res,
                    400,
                    "Utilisateur invalide."
                );
            }

            const finalAmount =
                Number(
                    amount ??
                    montant
                );

            if (
                !Number.isFinite(
                    finalAmount
                ) ||
                finalAmount <= 0
            ) {

                return failure(
                    res,
                    400,
                    "Montant invalide."
                );
            }

            const user =
                await pool.query(
                    `
                    SELECT id
                    FROM users
                    WHERE id = $1
                    `,
                    [userId]
                );

            if (!user.rows.length) {

                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            const result =
                await pool.query(
                    `
                    INSERT INTO demandes_paiement
                    (
                        user_id,
                        telephone_paiement,
                        reference_paiement,
                        amount,
                        montant,
                        currency,
                        methode,
                        proof,
                        recipient_number,
                        recipient_name,
                        premium_days,
                        notes
                    )
                    VALUES
                    (
                        $1,$2,$3,$4,$4,$5,
                        $6,$7,$8,$9,$10,$11
                    )
                    RETURNING *
                    `,
                    [
                        userId,

                        cleanString(
                            telephone_paiement
                        ),

                        cleanString(
                            reference_paiement
                        ),

                        finalAmount,

                        cleanString(
                            currency ||
                            "USD"
                        ),

                        cleanString(
                            methode
                        ),

                        proof ||
                            null,

                        cleanString(
                            recipient_number
                        ),

                        cleanString(
                            recipient_name
                        ),

                        Number(
                            premium_days ||
                            30
                        ),

                        cleanString(
                            notes
                        )
                    ]
                );

            return success(
                res,
                {
                    demande:
                        result.rows[0]
                },
                "Demande de paiement enregistrée."
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur demande paiement.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

app.get(
    "/api/demandes-paiement",
    adminAuth,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        d.*,

                        u.nom AS user_nom,

                        u.email AS user_email,

                        u.telephone AS user_telephone,

                        u.domaine AS user_domaine,

                        u.premium AS user_premium,

                        u.is_premium AS user_is_premium,

                        u.premium_until AS user_premium_until

                    FROM demandes_paiement d

                    LEFT JOIN users u
                        ON u.id = d.user_id

                    ORDER BY d.id DESC
                    `
                );

            return success(
                res,
                {
                    demandes:
                        result.rows,

                    total:
                        result.rows.length
                }
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur récupération demandes.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// PROGRESSION — ENREGISTRER
// ============================================================

app.patch(
    "/api/admin/users/:id/progression",
    adminAuth,
    async (req, res) => {

        try {

            const userId =
                parseId(
                    req.params.id
                );

            if (!userId) {

                return failure(
                    res,
                    400,
                    "ID utilisateur invalide."
                );
            }

            const {
                domaine,
                progression,
                lessons_completed,
                total_lessons,
                last_lesson,
                last_lesson_title,
                completed
            } = req.body || {};

            if (!cleanString(domaine)) {

                return failure(
                    res,
                    400,
                    "Le domaine est obligatoire."
                );
            }

            let progress =
                Number(
                    progression ?? 0
                );

            if (
                !Number.isFinite(
                    progress
                )
            ) {
                progress = 0;
            }

            progress =
                Math.max(
                    0,
                    Math.min(
                        100,
                        Math.round(
                            progress
                        )
                    )
                );

            const completedValue =
                completed === true ||
                completed === 1 ||
                completed === "1" ||
                progress >= 100;

            const result =
                await pool.query(
                    `
                    INSERT INTO course_progress
                    (
                        user_id,
                        domaine,
                        progression,
                        lessons_completed,
                        total_lessons,
                        last_lesson,
                        last_lesson_title,
                        completed,
                        completed_at,
                        updated_at
                    )
                    VALUES
                    (
                        $1,$2,$3,$4,$5,$6,$7,$8,
                        CASE
                            WHEN $8 = TRUE
                            THEN NOW()
                            ELSE NULL
                        END,
                        NOW()
                    )

                    ON CONFLICT
                    (user_id, domaine)

                    DO UPDATE SET

                        progression =
                            EXCLUDED.progression,

                        lessons_completed =
                            EXCLUDED.lessons_completed,

                        total_lessons =
                            EXCLUDED.total_lessons,

                        last_lesson =
                            EXCLUDED.last_lesson,

                        last_lesson_title =
                            EXCLUDED.last_lesson_title,

                        completed =
                            EXCLUDED.completed,

                        completed_at =
                            CASE
                                WHEN EXCLUDED.completed = TRUE
                                THEN COALESCE(
                                    course_progress.completed_at,
                                    NOW()
                                )
                                ELSE NULL
                            END,

                        updated_at =
                            NOW()

                    RETURNING *
                    `,
                    [
                        userId,

                        cleanString(
                            domaine
                        ),

                        progress,

                        Number(
                            lessons_completed ||
                            0
                        ),

                        Number(
                            total_lessons ||
                            0
                        ),

                        cleanString(
                            last_lesson
                        ),

                        cleanString(
                            last_lesson_title
                        ),

                        completedValue
                    ]
                );

            await logActivity(
                "UPDATE_PROGRESS",
                {
                    user_id:
                        userId,

                    domaine:
                        domaine,

                    progression:
                        progress
                },
                userId,
                req
            );

            return success(
                res,
                {
                    progression:
                        result.rows[0]
                },
                "Progression enregistrée."
            );

        } catch (error) {

            console.error(
                "Erreur progression:",
                error
            );

            return failure(
                res,
                500,
                "Erreur enregistrement progression.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// PROGRESSION D'UN UTILISATEUR
// ============================================================

app.get(
    "/api/admin/users/:id/progression",
    adminAuth,
    async (req, res) => {

        try {

            const userId =
                parseId(
                    req.params.id
                );

            if (!userId) {

                return failure(
                    res,
                    400,
                    "ID utilisateur invalide."
                );
            }

            const user =
                await pool.query(
                    `
                    SELECT
                        id,
                        nom,
                        email,
                        telephone,
                        domaine,
                        pays,
                        ville,
                        niveau,
                        photo,
                        premium,
                        is_premium,
                        premium_until,
                        certificate_authorized
                    FROM users
                    WHERE id = $1
                    `,
                    [userId]
                );

            if (!user.rows.length) {

                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            const progress =
                await pool.query(
                    `
                    SELECT *
                    FROM course_progress
                    WHERE user_id = $1
                    ORDER BY updated_at DESC
                    `,
                    [userId]
                );

            return success(
                res,
                {
                    user:
                        user.rows[0],

                    progressions:
                        progress.rows,

                    progression:
                        progress.rows
                }
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur récupération progression.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// TOUTES LES PROGRESSIONS
// ============================================================

app.get(
    "/api/admin/progressions",
    adminAuth,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        cp.*,

                        u.nom AS user_nom,

                        u.email AS user_email,

                        u.photo AS user_photo,

                        u.domaine AS user_domaine,

                        u.premium AS user_premium,

                        u.is_premium AS user_is_premium

                    FROM course_progress cp

                    LEFT JOIN users u
                        ON u.id = cp.user_id

                    ORDER BY cp.updated_at DESC
                    `
                );

            return success(
                res,
                {
                    progressions:
                        result.rows,

                    progression:
                        result.rows,

                    total:
                        result.rows.length
                }
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur récupération progressions.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// MESSAGES — ENVOYER À UN UTILISATEUR
// ============================================================

const MESSAGE_PRIORITIES = [
    "normal",
    "important",
    "urgent"
];

function normalizePriority(
    value
) {

    const v =
        cleanString(
            value
        ).toLowerCase();

    if (
        MESSAGE_PRIORITIES.includes(v)
    ) {
        return v;
    }

    return "normal";
}

app.post(
    "/api/messages/send-user",
    adminAuth,
    async (req, res) => {

        try {

            const {
                user_id,
                subject,
                content,
                priority
            } = req.body || {};

            const userId =
                parseId(user_id);

            if (!userId) {

                return failure(
                    res,
                    400,
                    "Utilisateur invalide."
                );
            }

            if (!cleanString(content)) {

                return failure(
                    res,
                    400,
                    "Le message est obligatoire."
                );
            }

            const user =
                await pool.query(
                    `
                    SELECT *
                    FROM users
                    WHERE id = $1
                    `,
                    [userId]
                );

            if (!user.rows.length) {

                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            const u =
                user.rows[0];

            const result =
                await pool.query(
                    `
                    INSERT INTO messages
                    (
                        sender_type,
                        sender_name,
                        sender_email,
                        recipient_user_id,
                        recipient_name,
                        recipient_email,
                        subject,
                        content,
                        type,
                        priority,
                        audience,
                        status
                    )
                    VALUES
                    (
                        'admin',
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        'official',
                        $8,
                        'individual',
                        'unread'
                    )
                    RETURNING *
                    `,
                    [
                        "BMJ SERVICE",

                        ADMIN_EMAIL,

                        userId,

                        u.nom,

                        u.email,

                        cleanString(
                            subject ||
                            "Message BMJ SERVICE"
                        ),

                        cleanString(
                            content
                        ),

                        normalizePriority(
                            priority
                        )
                    ]
                );

            await logActivity(
                "SEND_MESSAGE",
                {
                    user_id:
                        userId,

                    subject:
                        subject
                },
                userId,
                req
            );

            return success(
                res,
                {
                    message:
                        result.rows[0]
                },
                "Message envoyé."
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur envoi message.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// RÉPONDRE À UN UTILISATEUR
// ============================================================

app.post(
    "/api/admin/messages/reply",
    adminAuth,
    async (req, res) => {

        try {

            const {
                user_id,
                subject,
                content,
                priority
            } = req.body || {};

            const userId =
                parseId(user_id);

            if (!userId) {

                return failure(
                    res,
                    400,
                    "Utilisateur invalide."
                );
            }

            if (!cleanString(content)) {

                return failure(
                    res,
                    400,
                    "Le message est obligatoire."
                );
            }

            const user =
                await pool.query(
                    `
                    SELECT *
                    FROM users
                    WHERE id = $1
                    `,
                    [userId]
                );

            if (!user.rows.length) {

                return failure(
                    res,
                    404,
                    "Utilisateur introuvable."
                );
            }

            const u =
                user.rows[0];

            const result =
                await pool.query(
                    `
                    INSERT INTO messages
                    (
                        sender_type,
                        sender_name,
                        sender_email,

                        recipient_user_id,
                        recipient_name,
                        recipient_email,

                        subject,
                        content,

                        type,
                        priority,
                        audience,
                        status
                    )
                    VALUES
                    (
                        'admin',
                        $1,
                        $2,

                        $3,
                        $4,
                        $5,

                        $6,
                        $7,

                        'official',
                        $8,
                        'individual',
                        'unread'
                    )
                    RETURNING *
                    `,
                    [
                        "BMJ SERVICE",

                        ADMIN_EMAIL,

                        userId,

                        u.nom,

                        u.email,

                        cleanString(
                            subject ||
                            "Réponse BMJ SERVICE"
                        ),

                        cleanString(
                            content
                        ),

                        normalizePriority(
                            priority
                        )
                    ]
                );

            await logActivity(
                "REPLY_USER",
                {
                    user_id:
                        userId,

                    subject:
                        subject
                },
                userId,
                req
            );

            return success(
                res,
                {
                    message:
                        result.rows[0]
                },
                "Réponse envoyée."
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur réponse utilisateur.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// CONVERSATION ADMIN
// ============================================================

app.get(
    "/api/admin/users/:id/messages",
    adminAuth,
    async (req, res) => {

        try {

            const userId =
                parseId(
                    req.params.id
                );

            if (!userId) {

                return failure(
                    res,
                    400,
                    "ID utilisateur invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM messages

                    WHERE
                        recipient_user_id = $1
                        OR sender_user_id = $1

                    ORDER BY created_at ASC
                    `,
                    [userId]
                );

            return success(
                res,
                {
                    messages:
                        result.rows,

                    total:
                        result.rows.length
                }
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur récupération conversation.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// TOUS LES MESSAGES
// ============================================================

app.get(
    "/api/messages",
    adminAuth,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM messages
                    ORDER BY created_at DESC
                    `
                );

            return success(
                res,
                {
                    messages:
                        result.rows,

                    total:
                        result.rows.length
                }
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur récupération messages.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// MESSAGE LU
// ============================================================

app.patch(
    "/api/utilisateurs/:userId/messages/:messageId/read",
    async (req, res) => {

        try {

            const userId =
                parseId(
                    req.params.userId
                );

            const messageId =
                parseId(
                    req.params.messageId
                );

            if (
                !userId ||
                !messageId
            ) {

                return failure(
                    res,
                    400,
                    "ID invalide."
                );
            }

            const result =
                await pool.query(
                    `
                    UPDATE messages
                    SET
                        status = 'read',
                        read_at = NOW(),
                        updated_at = NOW()
                    WHERE
                        id = $1
                        AND recipient_user_id = $2
                    RETURNING *
                    `,
                    [
                        messageId,
                        userId
                    ]
                );

            if (!result.rows.length) {

                return failure(
                    res,
                    404,
                    "Message introuvable."
                );
            }

            return success(
                res,
                {
                    message:
                        result.rows[0]
                },
                "Message marqué comme lu."
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur lecture message.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// ACTIVITÉS ADMIN
// ============================================================

app.get(
    "/api/admin/activites",
    adminAuth,
    async (req, res) => {

        try {

            const requested =
                Number(
                    req.query.limit ||
                    100
                );

            const limit =
                Math.min(
                    Math.max(
                        requested,
                        1
                    ),
                    500
                );

            const result =
                await pool.query(
                    `
                    SELECT
                        a.*,

                        u.nom AS user_nom,

                        u.email AS user_email

                    FROM admin_activity a

                    LEFT JOIN users u
                        ON u.id = a.user_id

                    ORDER BY a.created_at DESC

                    LIMIT $1
                    `,
                    [limit]
                );

            return success(
                res,
                {
                    activites:
                        result.rows,

                    activities:
                        result.rows,

                    total:
                        result.rows.length
                }
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur activités admin.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// STATISTIQUES ADMIN
// ============================================================

app.get(
    "/api/admin/statistiques",
    adminAuth,
    async (req, res) => {

        try {

            const users =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::int AS total,

                        COUNT(*) FILTER
                        (
                            WHERE
                                premium = TRUE
                                OR is_premium = TRUE
                                OR (
                                    premium_until IS NOT NULL
                                    AND premium_until > NOW()
                                )
                        )::int AS premium,

                        COUNT(*) FILTER
                        (
                            WHERE
                                blocked = TRUE
                                OR is_blocked = TRUE
                        )::int AS blocked

                    FROM users
                    `
                );

            const payments =
                await pool.query(
                    `
                    SELECT

                        COUNT(*)::int AS total,

                        COUNT(*) FILTER
                        (
                            WHERE status = 'pending'
                        )::int AS pending,

                        COUNT(*) FILTER
                        (
                            WHERE status = 'validated'
                        )::int AS validated,

                        COUNT(*) FILTER
                        (
                            WHERE status = 'refused'
                        )::int AS refused,

                        COALESCE(
                            SUM(
                                COALESCE(
                                    amount,
                                    montant,
                                    0
                                )
                            )
                            FILTER
                            (
                                WHERE status = 'validated'
                            ),
                            0
                        )::numeric AS revenues

                    FROM paiements
                    `
                );

            const requests =
                await pool.query(
                    `
                    SELECT

                        COUNT(*)::int AS total,

                        COUNT(*) FILTER
                        (
                            WHERE status = 'pending'
                        )::int AS pending,

                        COUNT(*) FILTER
                        (
                            WHERE status = 'validated'
                        )::int AS validated,

                        COUNT(*) FILTER
                        (
                            WHERE status = 'refused'
                        )::int AS refused

                    FROM demandes_paiement
                    `
                );

            const messages =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::int AS total,

                        COUNT(*) FILTER
                        (
                            WHERE status = 'unread'
                        )::int AS unread

                    FROM messages
                    `
                );

            const progress =
                await pool.query(
                    `
                    SELECT

                        COUNT(*)::int AS total,

                        COUNT(*) FILTER
                        (
                            WHERE completed = TRUE
                        )::int AS completed,

                        COALESCE(
                            ROUND(
                                AVG(progression)
                            ),
                            0
                        )::int AS average

                    FROM course_progress
                    `
                );

            const total =
                Number(
                    users.rows[0].total
                );

            const premium =
                Number(
                    users.rows[0].premium
                );

            const blocked =
                Number(
                    users.rows[0].blocked
                );

            return success(
                res,
                {
                    statistiques: {

                        utilisateurs:
                            total,

                        total_users:
                            total,

                        premium,

                        premium_users:
                            premium,

                        bloques:
                            blocked,

                        blocked_users:
                            blocked,

                        standard:
                            total - premium,

                        paiements:
                            payments.rows[0],

                        demandes:
                            requests.rows[0],

                        messages:
                            messages.rows[0],

                        progression:
                            progress.rows[0]
                    }
                }
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur statistiques.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// STATISTIQUES PUBLIQUES COMPATIBILITÉ
// ============================================================

app.get(
    "/api/statistiques",
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT

                        COUNT(*)::int AS utilisateurs,

                        COUNT(*) FILTER
                        (
                            WHERE
                                premium = TRUE
                                OR is_premium = TRUE
                                OR (
                                    premium_until IS NOT NULL
                                    AND premium_until > NOW()
                                )
                        )::int AS premium

                    FROM users
                    `
                );

            return success(
                res,
                {
                    utilisateurs:
                        result.rows[0]
                            .utilisateurs,

                    premium:
                        result.rows[0]
                            .premium
                }
            );

        } catch (error) {

            return failure(
                res,
                500,
                "Erreur statistiques.",
                {
                    error:
                        error.message
                }
            );
        }
    }
);

// ============================================================
// ROUTES
// ============================================================

app.get(
    "/api/routes",
    (req, res) => {

        res.json({
            success: true,

            routes: [

                "GET /",

                "GET /api",

                "GET /api/health",

                "GET /api/test-db",

                "POST /api/inscription",

                "POST /api/register",

                "POST /api/signup",

                "POST /api/connexion",

                "POST /api/login",

                "POST /api/signin",

                "POST /api/admin/login",

                "GET /api/utilisateurs",

                "GET /api/admin/utilisateurs",

                "GET /api/apprenants",

                "GET /api/utilisateurs/:id",

                "PATCH /api/admin/users/:id",

                "PATCH /api/admin/users/:id/premium",

                "PATCH /api/admin/users/:id/standard",

                "PATCH /api/admin/users/:id/block",

                "PATCH /api/admin/users/:id/unblock",

                "PATCH /api/admin/users/:id/certificate",

                "GET /api/users/:id/certificate-access",

                "POST /api/paiements",

                "GET /api/paiements",

                "GET /api/paiements/:id",

                "PATCH /api/paiements/:id/valider",

                "PATCH /api/paiements/:id/refuser",

                "POST /api/demandes-paiement",

                "GET /api/demandes-paiement",

                "PATCH /api/admin/users/:id/progression",

                "GET /api/admin/users/:id/progression",

                "GET /api/admin/progressions",

                "POST /api/messages/send-user",

                "POST /api/admin/messages/reply",

                "GET /api/admin/users/:id/messages",

                "GET /api/messages",

                "PATCH /api/utilisateurs/:userId/messages/:messageId/read",

                "GET /api/admin/activites",

                "GET /api/admin/statistiques",

                "GET /api/statistiques"

            ]
        });
    }
);

// ============================================================
// 404
// ============================================================

app.use(
    (req, res) => {

        return res.status(404)
            .json({

                success: false,

                message:
                    "Route introuvable.",

                method:
                    req.method,

                path:
                    req.originalUrl
            });
    }
);

// ============================================================
// ERREUR GLOBALE
// ============================================================

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "Erreur serveur:",
            error
        );

        if (
            res.headersSent
        ) {

            return next(error);
        }

        return res.status(500)
            .json({

                success: false,

                message:
                    "Erreur interne du serveur.",

                error:
                    error.message
            });
    }
);

// ============================================================
// ARRÊT PROPRE
// ============================================================

async function shutdown(
    signal
) {

    console.log(
        `\n🛑 Signal ${signal} reçu.`
    );

    try {

        await pool.end();

        console.log(
            "✅ PostgreSQL fermé."
        );

        process.exit(0);

    } catch (error) {

        console.error(
            "Erreur fermeture:",
            error
        );

        process.exit(1);
    }
}

process.on(
    "SIGTERM",
    () =>
        shutdown(
            "SIGTERM"
        )
);

process.on(
    "SIGINT",
    () =>
        shutdown(
            "SIGINT"
        )
);

// ============================================================
// DÉMARRAGE
// ============================================================

async function startServer() {

    try {

        if (!DATABASE_URL) {

            throw new Error(
                "DATABASE_URL est absente."
            );
        }

        await initDatabase();

        app.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log("");

                console.log(
                    "=============================================="
                );

                console.log(
                    "          BMJ SERVICE BACKEND"
                );

                console.log(
                    "=============================================="
                );

                console.log(
                    `🚀 PORT : ${PORT}`
                );

                console.log(
                    "🗄️ PostgreSQL : CONNECTÉ"
                );

                console.log(
                    "☁️ Render : PRÊT"
                );

                console.log(
                    "👑 Administration : ACTIVE"
                );

                console.log(
                    `👤 Admin : ${ADMIN_EMAIL}`
                );

                console.log(
                    `👤 Justin : ${JUSTIN_EMAIL}`
                );

                console.log(
                    `👥 Utilisateurs BMJ : ${DEMO_USERS.length}`
                );

                console.log(
                    "🔐 Gestion Premium : ACTIVE"
                );

                console.log(
                    "🚫 Blocage utilisateurs : ACTIVE"
                );

                console.log(
                    "💳 Gestion paiements : ACTIVE"
                );

                console.log(
                    "💬 Messagerie : ACTIVE"
                );

                console.log(
                    "📚 Progression cours : ACTIVE"
                );

                console.log(
                    "🏆 Autorisation certificats : ACTIVE"
                );

                console.log(
                    "=============================================="
                );

                console.log("");
            }
        );

    } catch (error) {

        console.error("");

        console.error(
            "❌ IMPOSSIBLE DE DÉMARRER BMJ SERVICE"
        );

        console.error(
            error
        );

        console.error("");

        process.exit(1);
    }
}

startServer();