/* ============================================================
   BMJ SERVICE
   BACKEND API COMPLET
   NODE.JS + EXPRESS + POSTGRESQL
   DESTINATION : RENDER

   VERSION : 13.0.0

   ============================================================
   FONCTIONNALITÉS
   ------------------------------------------------------------
   - PostgreSQL
   - CORS
   - Inscription utilisateur
   - Connexion utilisateur
   - Authentification administrateur
   - Dashboard administrateur
   - Gestion utilisateurs
   - Modification utilisateurs
   - Suppression utilisateurs
   - Blocage / déblocage
   - Activation / désactivation Premium
   - Système de paiements existant
   - NOUVEAU système séparé de demandes de paiement
   - Validation demande de paiement
   - Refus demande de paiement
   - Activation automatique Premium
   - Statistiques
   - Journal administrateur
   - Health check
   - Graceful shutdown

   IMPORTANT
   ------------------------------------------------------------
   La nouvelle page de demande de paiement utilise :

       POST /api/demandes-paiement

   Elle n'utilise PAS :

       POST /api/paiements

   Données de la nouvelle demande :

       user_id
       telephone_paiement
       reference_paiement

============================================================ */


/* ============================================================
   24. NOUVELLE MESSAGERIE BMJ SERVICE
   ============================================================

   SYSTÈME COMPLET :

   ADMIN :
   - Voir tous les messages
   - Voir les réponses utilisateurs
   - Envoyer à un utilisateur
   - Envoyer à tous
   - Envoyer aux standards
   - Envoyer aux premium
   - Modifier
   - Changer destinataire
   - Convertir individuel -> officiel
   - Convertir officiel -> individuel
   - Supprimer

   UTILISATEUR :
   - Voir ses messages
   - Voir les communiqués
   - Voir les réponses
   - Marquer comme lu
   - Répondre à un message individuel
   - Impossible de répondre à un communiqué

   IMPORTANT :
   Cette section remplace toutes les anciennes
   routes de messagerie.
============================================================ */


/* ============================================================
   24.1 OUTILS MESSAGERIE
============================================================ */

const MESSAGE_TYPES = {
    USER: "user",
    OFFICIAL: "official",
    USER_REPLY: "user_reply"
};


const MESSAGE_PRIORITIES = [
    "normal",
    "important",
    "urgent"
];


const MESSAGE_AUDIENCES = [
    "all",
    "standard",
    "premium",
    "individual",
    "admin"
];


/* ============================================================
   NORMALISER PRIORITÉ
============================================================ */

function normalizeMessagePriority(value) {

    const priority =
        String(
            value || "normal"
        )
        .trim()
        .toLowerCase();


    if (
        MESSAGE_PRIORITIES.includes(
            priority
        )
    ) {

        return priority;

    }


    return "normal";

}


/* ============================================================
   NORMALISER AUDIENCE
============================================================ */

function normalizeMessageAudience(value) {

    const audience =
        String(
            value || "all"
        )
        .trim()
        .toLowerCase();


    if (
        MESSAGE_AUDIENCES.includes(
            audience
        )
    ) {

        return audience;

    }


    return "all";

}


/* ============================================================
   UTILISATEUR PAR ID
============================================================ */

async function getMessageUserById(userId) {

    const id =
        parseId(userId);


    if (!id) {

        return null;

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
                photo,

                premium,
                is_premium,
                premium_until,

                blocked,
                is_blocked,

                created_at,
                updated_at

            FROM users

            WHERE id = $1

            LIMIT 1
            `,

            [id]

        );


    return (
        result.rows[0] ||
        null
    );

}


/* ============================================================
   VÉRIFIER SI UTILISATEUR PREMIUM
============================================================ */

function isMessageUserPremium(user) {

    if (!user) {

        return false;

    }


    return (
        user.premium === true ||
        user.is_premium === true
    );

}


/* ============================================================
   JOURNALISATION SÉCURISÉE
   IMPORTANT :
   Une erreur du journal ne doit jamais bloquer
   l'envoi ou la modification d'un message.
============================================================ */

async function safeMessageActivity(
    action,
    description,
    userId = null,
    messageId = null
) {

    try {

        await logActivity(

            action,

            description,

            userId,

            messageId

        );

    } catch (err) {

        console.error(

            "[MESSAGERIE] Erreur journal :",

            err.message || err

        );

    }

}


/* ============================================================
   RÉCUPÉRER UN MESSAGE COMPLET
============================================================ */

async function getCompleteMessageById(messageId) {

    const id =
        parseId(messageId);


    if (!id) {

        return null;

    }


    const result =
        await pool.query(

            `
            SELECT

                m.*,

                u.nom AS user_nom_db,
                u.email AS user_email_db,
                u.telephone AS user_telephone_db,

                u.premium AS user_premium_db,
                u.is_premium AS user_is_premium_db,

                u.blocked AS user_blocked_db,
                u.is_blocked AS user_is_blocked_db

            FROM messages m

            LEFT JOIN users u
                ON u.id = m.recipient_user_id

            WHERE m.id = $1

            LIMIT 1
            `,

            [id]

        );


    return (
        result.rows[0] ||
        null
    );

}


/* ============================================================
   24.2 ADMIN — TOUS LES MESSAGES
============================================================ */

app.get(

    "/api/messages",

    adminAuth,

    async function(req, res) {

        try {

            const result =
                await pool.query(

                    `
                    SELECT

                        m.*,

                        u.nom AS user_nom_db,
                        u.email AS user_email_db,
                        u.telephone AS user_telephone_db,

                        u.premium AS user_premium_db,
                        u.is_premium AS user_is_premium_db,

                        u.blocked AS user_blocked_db,
                        u.is_blocked AS user_is_blocked_db

                    FROM messages m

                    LEFT JOIN users u
                        ON u.id =
                           m.recipient_user_id

                    ORDER BY
                        m.created_at DESC,
                        m.id DESC

                    LIMIT 2000
                    `

                );


            return res.json({

                success: true,

                messages:
                    result.rows,

                count:
                    result.rows.length

            });


        } catch (err) {

            console.error(

                "GET /api/messages :",

                err

            );


            return error(

                res,

                "Impossible de récupérer les messages.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.3 ADMIN — UN MESSAGE
============================================================ */

app.get(

    "/api/messages/:id",

    adminAuth,

    async function(req, res) {

        try {

            const id =
                parseId(
                    req.params.id
                );


            if (!id) {

                return error(

                    res,

                    "Identifiant de message invalide.",

                    400

                );

            }


            const message =
                await getCompleteMessageById(
                    id
                );


            if (!message) {

                return error(

                    res,

                    "Message introuvable.",

                    404

                );

            }


            return res.json({

                success: true,

                message

            });


        } catch (err) {

            console.error(

                "GET /api/messages/:id :",

                err

            );


            return error(

                res,

                "Impossible de récupérer le message.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.4 ADMIN — ENVOYER À UN SEUL UTILISATEUR
============================================================ */

app.post(

    "/api/messages/send-user",

    adminAuth,

    async function(req, res) {

        try {

            const body =
                req.body || {};


            const userId =
                parseId(

                    body.user_id ??
                    body.recipient_id

                );


            const subject =
                String(

                    body.subject ||
                    ""

                ).trim();


            const content =
                String(

                    body.content ??
                    body.message ??
                    ""

                ).trim();


            const priority =
                normalizeMessagePriority(
                    body.priority
                );


            if (!userId) {

                return error(

                    res,

                    "Veuillez sélectionner un utilisateur.",

                    400

                );

            }


            if (!subject) {

                return error(

                    res,

                    "Le sujet est obligatoire.",

                    400

                );

            }


            if (!content) {

                return error(

                    res,

                    "Le contenu est obligatoire.",

                    400

                );

            }


            if (subject.length > 500) {

                return error(

                    res,

                    "Le sujet ne peut pas dépasser 500 caractères.",

                    400

                );

            }


            if (content.length > 10000) {

                return error(

                    res,

                    "Le message ne peut pas dépasser 10 000 caractères.",

                    400

                );

            }


            const user =
                await getMessageUserById(
                    userId
                );


            if (!user) {

                return error(

                    res,

                    "Utilisateur introuvable.",

                    404

                );

            }


            if (
                user.blocked === true ||
                user.is_blocked === true
            ) {

                return error(

                    res,

                    "Impossible d'envoyer un message à un utilisateur bloqué.",

                    403

                );

            }


            const result =
                await pool.query(

                    `
                    INSERT INTO messages
                    (
                        sender_type,
                        sender_email,

                        recipient_user_id,
                        recipient_name,
                        recipient_email,

                        type,

                        subject,
                        content,

                        priority,
                        status,
                        audience,

                        read_at,

                        created_at,
                        updated_at
                    )

                    VALUES
                    (
                        'admin',
                        $1,

                        $2,
                        $3,
                        $4,

                        'user',

                        $5,
                        $6,

                        $7,
                        'sent',
                        'individual',

                        NULL,

                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )

                    RETURNING *
                    `,

                    [

                        ADMIN_EMAIL,

                        user.id,

                        user.nom ||
                            "Utilisateur",

                        user.email ||
                            "",

                        subject,

                        content,

                        priority

                    ]

                );


            const message =
                result.rows[0];


            await safeMessageActivity(

                "MESSAGE_ENVOYE",

                `Message envoyé à ${user.nom || user.email || "Utilisateur"} — ID utilisateur ${user.id}`,

                user.id,

                message.id

            );


            return res.status(201).json({

                success: true,

                message:
                    "Message envoyé avec succès.",

                data:
                    message

            });


        } catch (err) {

            console.error(

                "POST /api/messages/send-user :",

                err

            );


            return error(

                res,

                "Impossible d'envoyer le message.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.5 COMPATIBILITÉ ANCIEN NOM
   POST /api/messages/user
============================================================ */

app.post(

    "/api/messages/user",

    adminAuth,

    async function(req, res, next) {

        try {

            const body =
                req.body || {};


            const userId =
                parseId(

                    body.user_id ??
                    body.recipient_id

                );


            const subject =
                String(
                    body.subject || ""
                ).trim();


            const content =
                String(
                    body.content ??
                    body.message ??
                    ""
                ).trim();


            const priority =
                normalizeMessagePriority(
                    body.priority
                );


            if (!userId) {

                return error(
                    res,
                    "Veuillez sélectionner un utilisateur.",
                    400
                );

            }


            if (!subject) {

                return error(
                    res,
                    "Le sujet est obligatoire.",
                    400
                );

            }


            if (!content) {

                return error(
                    res,
                    "Le contenu est obligatoire.",
                    400
                );

            }


            const user =
                await getMessageUserById(
                    userId
                );


            if (!user) {

                return error(
                    res,
                    "Utilisateur introuvable.",
                    404
                );

            }


            const result =
                await pool.query(

                    `
                    INSERT INTO messages
                    (
                        sender_type,
                        sender_email,

                        recipient_user_id,
                        recipient_name,
                        recipient_email,

                        type,
                        subject,
                        content,

                        priority,
                        status,
                        audience,

                        read_at,
                        created_at,
                        updated_at
                    )

                    VALUES
                    (
                        'admin',
                        $1,

                        $2,
                        $3,
                        $4,

                        'user',
                        $5,
                        $6,

                        $7,
                        'sent',
                        'individual',

                        NULL,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )

                    RETURNING *
                    `,

                    [

                        ADMIN_EMAIL,

                        user.id,

                        user.nom ||
                            "Utilisateur",

                        user.email ||
                            "",

                        subject,

                        content,

                        priority

                    ]

                );


            const message =
                result.rows[0];


            await safeMessageActivity(

                "MESSAGE_ENVOYE",

                `Message individuel envoyé à ${user.nom || user.email || "Utilisateur"}`,

                user.id,

                message.id

            );


            return res.status(201).json({

                success: true,

                message:
                    "Message envoyé avec succès.",

                data:
                    message

            });


        } catch (err) {

            console.error(

                "POST /api/messages/user :",

                err

            );


            return error(

                res,

                "Impossible d'envoyer le message.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.6 ADMIN — COMMUNIQUÉ POUR TOUT LE MONDE
============================================================ */

app.post(

    "/api/messages/send-all",

    adminAuth,

    async function(req, res) {

        try {

            const body =
                req.body || {};


            const subject =
                String(
                    body.subject || ""
                ).trim();


            const content =
                String(
                    body.content ??
                    body.message ??
                    ""
                ).trim();


            const priority =
                normalizeMessagePriority(
                    body.priority
                );


            if (!subject) {

                return error(
                    res,
                    "Le sujet est obligatoire.",
                    400
                );

            }


            if (!content) {

                return error(
                    res,
                    "Le contenu est obligatoire.",
                    400
                );

            }


            const result =
                await pool.query(

                    `
                    INSERT INTO messages
                    (
                        sender_type,
                        sender_email,

                        recipient_user_id,
                        recipient_name,
                        recipient_email,

                        type,

                        subject,
                        content,

                        priority,
                        status,
                        audience,

                        read_at,
                        created_at,
                        updated_at
                    )

                    VALUES
                    (
                        'admin',
                        $1,

                        NULL,
                        NULL,
                        NULL,

                        'official',

                        $2,
                        $3,

                        $4,
                        'sent',
                        'all',

                        NULL,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )

                    RETURNING *
                    `,

                    [

                        ADMIN_EMAIL,

                        subject,

                        content,

                        priority

                    ]

                );


            const message =
                result.rows[0];


            await safeMessageActivity(

                "COMMUNIQUE_TOUT",

                `Communiqué envoyé à tous les utilisateurs — message ${message.id}`,

                null,

                message.id

            );


            return res.status(201).json({

                success: true,

                message:
                    "Communiqué envoyé à tous les utilisateurs.",

                data:
                    message

            });


        } catch (err) {

            console.error(

                "POST /api/messages/send-all :",

                err

            );


            return error(

                res,

                "Impossible d'envoyer le communiqué.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.7 ADMIN — MESSAGE AUX MEMBRES PREMIUM
============================================================ */

app.post(

    "/api/messages/send-premium",

    adminAuth,

    async function(req, res) {

        try {

            const body =
                req.body || {};


            const subject =
                String(
                    body.subject || ""
                ).trim();


            const content =
                String(
                    body.content ??
                    body.message ??
                    ""
                ).trim();


            const priority =
                normalizeMessagePriority(
                    body.priority
                );


            if (!subject) {

                return error(
                    res,
                    "Le sujet est obligatoire.",
                    400
                );

            }


            if (!content) {

                return error(
                    res,
                    "Le contenu est obligatoire.",
                    400
                );

            }


            const result =
                await pool.query(

                    `
                    INSERT INTO messages
                    (
                        sender_type,
                        sender_email,

                        recipient_user_id,
                        recipient_name,
                        recipient_email,

                        type,

                        subject,
                        content,

                        priority,
                        status,
                        audience,

                        read_at,
                        created_at,
                        updated_at
                    )

                    VALUES
                    (
                        'admin',
                        $1,

                        NULL,
                        NULL,
                        NULL,

                        'official',

                        $2,
                        $3,

                        $4,
                        'sent',
                        'premium',

                        NULL,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )

                    RETURNING *
                    `,

                    [

                        ADMIN_EMAIL,

                        subject,

                        content,

                        priority

                    ]

                );


            const message =
                result.rows[0];


            await safeMessageActivity(

                "COMMUNIQUE_PREMIUM",

                `Message envoyé aux membres premium — message ${message.id}`,

                null,

                message.id

            );


            return res.status(201).json({

                success: true,

                message:
                    "Message envoyé aux membres premium.",

                data:
                    message

            });


        } catch (err) {

            console.error(

                "POST /api/messages/send-premium :",

                err

            );


            return error(

                res,

                "Impossible d'envoyer le message aux membres premium.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.8 ADMIN — MESSAGE AUX MEMBRES STANDARDS
============================================================ */

app.post(

    "/api/messages/send-standard",

    adminAuth,

    async function(req, res) {

        try {

            const body =
                req.body || {};


            const subject =
                String(
                    body.subject || ""
                ).trim();


            const content =
                String(
                    body.content ??
                    body.message ??
                    ""
                ).trim();


            const priority =
                normalizeMessagePriority(
                    body.priority
                );


            if (!subject) {

                return error(
                    res,
                    "Le sujet est obligatoire.",
                    400
                );

            }


            if (!content) {

                return error(
                    res,
                    "Le contenu est obligatoire.",
                    400
                );

            }


            const result =
                await pool.query(

                    `
                    INSERT INTO messages
                    (
                        sender_type,
                        sender_email,

                        recipient_user_id,
                        recipient_name,
                        recipient_email,

                        type,

                        subject,
                        content,

                        priority,
                        status,
                        audience,

                        read_at,
                        created_at,
                        updated_at
                    )

                    VALUES
                    (
                        'admin',
                        $1,

                        NULL,
                        NULL,
                        NULL,

                        'official',

                        $2,
                        $3,

                        $4,
                        'sent',
                        'standard',

                        NULL,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )

                    RETURNING *
                    `,

                    [

                        ADMIN_EMAIL,

                        subject,

                        content,

                        priority

                    ]

                );


            const message =
                result.rows[0];


            await safeMessageActivity(

                "COMMUNIQUE_STANDARD",

                `Message envoyé aux membres standards — message ${message.id}`,

                null,

                message.id

            );


            return res.status(201).json({

                success: true,

                message:
                    "Message envoyé aux membres standards.",

                data:
                    message

            });


        } catch (err) {

            console.error(

                "POST /api/messages/send-standard :",

                err

            );


            return error(

                res,

                "Impossible d'envoyer le message aux membres standards.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.9 ADMIN — ROUTE UNIQUE POUR LES COMMUNIQUÉS
============================================================ */

app.post(

    "/api/messages/send-official",

    adminAuth,

    async function(req, res) {

        try {

            const body =
                req.body || {};


            const subject =
                String(
                    body.subject || ""
                ).trim();


            const content =
                String(
                    body.content ??
                    body.message ??
                    ""
                ).trim();


            const priority =
                normalizeMessagePriority(
                    body.priority
                );


            const audience =
                normalizeMessageAudience(
                    body.audience
                );


            if (!subject) {

                return error(
                    res,
                    "Le sujet est obligatoire.",
                    400
                );

            }


            if (!content) {

                return error(
                    res,
                    "Le contenu est obligatoire.",
                    400
                );

            }


            if (
                ![
                    "all",
                    "premium",
                    "standard"
                ].includes(audience)
            ) {

                return error(
                    res,
                    "Audience invalide.",
                    400
                );

            }


            const result =
                await pool.query(

                    `
                    INSERT INTO messages
                    (
                        sender_type,
                        sender_email,

                        recipient_user_id,
                        recipient_name,
                        recipient_email,

                        type,

                        subject,
                        content,

                        priority,
                        status,
                        audience,

                        read_at,
                        created_at,
                        updated_at
                    )

                    VALUES
                    (
                        'admin',
                        $1,

                        NULL,
                        NULL,
                        NULL,

                        'official',

                        $2,
                        $3,

                        $4,
                        'sent',
                        $5,

                        NULL,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )

                    RETURNING *
                    `,

                    [

                        ADMIN_EMAIL,

                        subject,

                        content,

                        priority,

                        audience

                    ]

                );


            const message =
                result.rows[0];


            await safeMessageActivity(

                "COMMUNIQUE_ENVOYE",

                `Communiqué envoyé — audience ${audience}`,

                null,

                message.id

            );


            return res.status(201).json({

                success: true,

                message:
                    "Communiqué publié avec succès.",

                data:
                    message

            });


        } catch (err) {

            console.error(

                "POST /api/messages/send-official :",

                err

            );


            return error(

                res,

                "Impossible de publier le communiqué.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.10 ANCIEN NOM OFFICIAL — COMPATIBILITÉ
============================================================ */

app.post(

    "/api/messages/official",

    adminAuth,

    async function(req, res) {

        try {

            const body =
                req.body || {};


            const subject =
                String(
                    body.subject || ""
                ).trim();


            const content =
                String(
                    body.content ??
                    body.message ??
                    ""
                ).trim();


            const priority =
                normalizeMessagePriority(
                    body.priority
                );


            const audience =
                normalizeMessageAudience(
                    body.audience
                );


            if (!subject || !content) {

                return error(
                    res,
                    "Le sujet et le contenu sont obligatoires.",
                    400
                );

            }


            if (
                ![
                    "all",
                    "premium",
                    "standard"
                ].includes(audience)
            ) {

                return error(
                    res,
                    "Audience invalide.",
                    400
                );

            }


            const result =
                await pool.query(

                    `
                    INSERT INTO messages
                    (
                        sender_type,
                        sender_email,

                        type,
                        subject,
                        content,

                        priority,
                        status,
                        audience,

                        created_at,
                        updated_at
                    )

                    VALUES
                    (
                        'admin',
                        $1,

                        'official',
                        $2,
                        $3,

                        $4,
                        'sent',
                        $5,

                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )

                    RETURNING *
                    `,

                    [

                        ADMIN_EMAIL,

                        subject,

                        content,

                        priority,

                        audience

                    ]

                );


            const message =
                result.rows[0];


            await safeMessageActivity(

                "COMMUNIQUE_ENVOYE",

                `Communiqué publié — audience ${audience}`,

                null,

                message.id

            );


            return res.status(201).json({

                success: true,

                message:
                    "Communiqué publié avec succès.",

                data:
                    message

            });


        } catch (err) {

            console.error(

                "POST /api/messages/official :",

                err

            );


            return error(

                res,

                "Impossible de publier le communiqué.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.11 ADMIN — MODIFIER UN MESSAGE
============================================================ */

app.patch(

    "/api/messages/:id",

    adminAuth,

    async function(req, res) {

        try {

            const id =
                parseId(
                    req.params.id
                );


            if (!id) {

                return error(
                    res,
                    "Identifiant de message invalide.",
                    400
                );

            }


            const existing =
                await getCompleteMessageById(
                    id
                );


            if (!existing) {

                return error(
                    res,
                    "Message introuvable.",
                    404
                );

            }


            const body =
                req.body || {};


            let type =
                String(

                    body.type ??
                    existing.type ??
                    "user"

                )
                .trim()
                .toLowerCase();


            /*
               Une réponse utilisateur ne doit pas
               devenir un message administrateur
               par modification normale.
            */

            if (
                type === "user_reply"
            ) {

                return error(

                    res,

                    "Une réponse utilisateur ne peut pas être transformée directement en message administrateur.",

                    400

                );

            }


            if (
                ![
                    "user",
                    "official"
                ].includes(type)
            ) {

                return error(
                    res,
                    "Type de message invalide.",
                    400
                );

            }


            const subject =
                String(

                    body.subject ??
                    existing.subject ??
                    ""

                ).trim();


            const content =
                String(

                    body.content ??
                    existing.content ??
                    ""

                ).trim();


            const priority =
                normalizeMessagePriority(

                    body.priority ??
                    existing.priority

                );


            if (!subject) {

                return error(
                    res,
                    "Le sujet est obligatoire.",
                    400
                );

            }


            if (!content) {

                return error(
                    res,
                    "Le contenu est obligatoire.",
                    400
                );

            }


            if (type === "user") {

                const userId =
                    parseId(

                        body.user_id ??
                        body.recipient_id ??
                        existing.recipient_user_id

                    );


                if (!userId) {

                    return error(
                        res,
                        "Le destinataire est obligatoire.",
                        400
                    );

                }


                const user =
                    await getMessageUserById(
                        userId
                    );


                if (!user) {

                    return error(
                        res,
                        "Utilisateur destinataire introuvable.",
                        404
                    );

                }


                const result =
                    await pool.query(

                        `
                        UPDATE messages

                        SET

                            sender_type = 'admin',
                            sender_email = $1,

                            recipient_user_id = $2,
                            recipient_name = $3,
                            recipient_email = $4,

                            type = 'user',

                            subject = $5,
                            content = $6,

                            priority = $7,

                            status = 'sent',
                            audience = 'individual',

                            read_at = NULL,

                            updated_at =
                                CURRENT_TIMESTAMP

                        WHERE id = $8

                        RETURNING *
                        `,

                        [

                            ADMIN_EMAIL,

                            user.id,

                            user.nom ||
                                "Utilisateur",

                            user.email ||
                                "",

                            subject,

                            content,

                            priority,

                            id

                        ]

                    );


                const updated =
                    result.rows[0];


                await safeMessageActivity(

                    "MESSAGE_MODIFIE",

                    `Message individuel modifié — utilisateur ${user.id}`,

                    user.id,

                    id

                );


                return res.json({

                    success: true,

                    message:
                        "Message modifié avec succès.",

                    data:
                        updated

                });

            }


            const audience =
                normalizeMessageAudience(

                    body.audience ??
                    existing.audience ??
                    "all"

                );


            if (
                ![
                    "all",
                    "premium",
                    "standard"
                ].includes(audience)
            ) {

                return error(
                    res,
                    "Audience invalide.",
                    400
                );

            }


            const result =
                await pool.query(

                    `
                    UPDATE messages

                    SET

                        sender_type = 'admin',
                        sender_email = $1,

                        recipient_user_id = NULL,
                        recipient_name = NULL,
                        recipient_email = NULL,

                        type = 'official',

                        subject = $2,
                        content = $3,

                        priority = $4,

                        status = 'sent',
                        audience = $5,

                        read_at = NULL,

                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE id = $6

                    RETURNING *
                    `,

                    [

                        ADMIN_EMAIL,

                        subject,

                        content,

                        priority,

                        audience,

                        id

                    ]

                );


            const updated =
                result.rows[0];


            await safeMessageActivity(

                "COMMUNIQUE_MODIFIE",

                `Communiqué modifié — audience ${audience}`,

                null,

                id

            );


            return res.json({

                success: true,

                message:
                    "Communiqué modifié avec succès.",

                data:
                    updated

            });


        } catch (err) {

            console.error(

                "PATCH /api/messages/:id :",

                err

            );


            return error(

                res,

                "Impossible de modifier le message.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.12 ADMIN — CONVERTIR MESSAGE
============================================================ */

app.post(

    "/api/messages/:id/convert",

    adminAuth,

    async function(req, res) {

        try {

            const id =
                parseId(
                    req.params.id
                );


            if (!id) {

                return error(
                    res,
                    "Identifiant de message invalide.",
                    400
                );

            }


            const existing =
                await getCompleteMessageById(
                    id
                );


            if (!existing) {

                return error(
                    res,
                    "Message introuvable.",
                    404
                );

            }


            const body =
                req.body || {};


            const mode =
                String(

                    body.mode ||
                    body.type ||
                    ""

                )
                .trim()
                .toLowerCase();


            /* =================================================
               INDIVIDUEL
            ================================================= */

            if (
                mode === "user" ||
                mode === "individual"
            ) {

                const userId =
                    parseId(

                        body.user_id ??
                        body.recipient_id

                    );


                if (!userId) {

                    return error(
                        res,
                        "Veuillez sélectionner le nouveau destinataire.",
                        400
                    );

                }


                const user =
                    await getMessageUserById(
                        userId
                    );


                if (!user) {

                    return error(
                        res,
                        "Utilisateur introuvable.",
                        404
                    );

                }


                const result =
                    await pool.query(

                        `
                        UPDATE messages

                        SET

                            sender_type = 'admin',
                            sender_email = $1,

                            recipient_user_id = $2,
                            recipient_name = $3,
                            recipient_email = $4,

                            type = 'user',

                            audience = 'individual',

                            status = 'sent',
                            read_at = NULL,

                            updated_at =
                                CURRENT_TIMESTAMP

                        WHERE id = $5

                        RETURNING *
                        `,

                        [

                            ADMIN_EMAIL,

                            user.id,

                            user.nom ||
                                "Utilisateur",

                            user.email ||
                                "",

                            id

                        ]

                    );


                const converted =
                    result.rows[0];


                await safeMessageActivity(

                    "MESSAGE_CONVERTI_INDIVIDUEL",

                    `Message converti en message individuel pour ${user.nom || user.email || user.id}`,

                    user.id,

                    id

                );


                return res.json({

                    success: true,

                    message:
                        "Message converti en message individuel.",

                    data:
                        converted

                });

            }


            /* =================================================
               OFFICIEL
            ================================================= */

            if (
                mode === "official"
            ) {

                const audience =
                    normalizeMessageAudience(

                        body.audience ||
                        "all"

                    );


                if (
                    ![
                        "all",
                        "premium",
                        "standard"
                    ].includes(audience)
                ) {

                    return error(
                        res,
                        "Audience officielle invalide.",
                        400
                    );

                }


                const result =
                    await pool.query(

                        `
                        UPDATE messages

                        SET

                            sender_type = 'admin',
                            sender_email = $1,

                            recipient_user_id = NULL,
                            recipient_name = NULL,
                            recipient_email = NULL,

                            type = 'official',

                            audience = $2,

                            status = 'sent',
                            read_at = NULL,

                            updated_at =
                                CURRENT_TIMESTAMP

                        WHERE id = $3

                        RETURNING *
                        `,

                        [

                            ADMIN_EMAIL,

                            audience,

                            id

                        ]

                    );


                const converted =
                    result.rows[0];


                await safeMessageActivity(

                    "MESSAGE_CONVERTI_OFFICIEL",

                    `Message converti en communiqué — audience ${audience}`,

                    null,

                    id

                );


                return res.json({

                    success: true,

                    message:
                        "Message converti en communiqué officiel.",

                    data:
                        converted

                });

            }


            return error(

                res,

                "Mode de conversion invalide. Utilisez user ou official.",

                400

            );


        } catch (err) {

            console.error(

                "POST /api/messages/:id/convert :",

                err

            );


            return error(

                res,

                "Impossible de convertir le message.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.13 ADMIN — SUPPRIMER MESSAGE
============================================================ */

app.delete(

    "/api/messages/:id",

    adminAuth,

    async function(req, res) {

        try {

            const id =
                parseId(
                    req.params.id
                );


            if (!id) {

                return error(
                    res,
                    "Identifiant de message invalide.",
                    400
                );

            }


            const existing =
                await getCompleteMessageById(
                    id
                );


            if (!existing) {

                return error(
                    res,
                    "Message introuvable.",
                    404
                );

            }


            await pool.query(

                `
                DELETE FROM messages

                WHERE id = $1
                `,

                [id]

            );


            await safeMessageActivity(

                "MESSAGE_SUPPRIME",

                `Message ${id} supprimé`,

                existing.recipient_user_id ||
                    null,

                id

            );


            return res.json({

                success: true,

                message:
                    "Message supprimé avec succès.",

                data: {

                    id

                }

            });


        } catch (err) {

            console.error(

                "DELETE /api/messages/:id :",

                err

            );


            return error(

                res,

                "Impossible de supprimer le message.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.14 UTILISATEUR — SES MESSAGES
============================================================ */

app.get(

    "/api/utilisateurs/:id/messages",

    async function(req, res) {

        try {

            const userId =
                parseId(
                    req.params.id
                );


            if (!userId) {

                return error(
                    res,
                    "Identifiant utilisateur invalide.",
                    400
                );

            }


            const user =
                await getMessageUserById(
                    userId
                );


            if (!user) {

                return error(
                    res,
                    "Utilisateur introuvable.",
                    404
                );

            }


            const premium =
                isMessageUserPremium(
                    user
                );


            const audience =
                premium
                    ? "premium"
                    : "standard";


            const result =
                await pool.query(

                    `
                    SELECT

                        m.*,

                        CASE

                            WHEN m.type = 'official'
                            THEN 'BMJ SERVICE'

                            ELSE
                                COALESCE(
                                    m.recipient_name,
                                    u.nom,
                                    'BMJ SERVICE'
                                )

                        END AS display_sender

                    FROM messages m

                    LEFT JOIN users u
                        ON u.id =
                           m.recipient_user_id

                    WHERE

                        (
                            m.recipient_user_id = $1
                        )

                        OR

                        (
                            m.type = 'official'

                            AND

                            (
                                m.audience = 'all'

                                OR
                                m.audience = $2
                            )
                        )

                    ORDER BY

                        m.created_at DESC,
                        m.id DESC

                    LIMIT 500
                    `,

                    [

                        userId,

                        audience

                    ]

                );


            return res.json({

                success: true,

                messages:
                    result.rows,

                count:
                    result.rows.length,

                user: {

                    id:
                        user.id,

                    nom:
                        user.nom,

                    premium

                }

            });


        } catch (err) {

            console.error(

                "GET /api/utilisateurs/:id/messages :",

                err

            );


            return error(

                res,

                "Impossible de récupérer vos messages.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.15 UTILISATEUR — UN MESSAGE
============================================================ */

app.get(

    "/api/utilisateurs/:userId/messages/:messageId",

    async function(req, res) {

        try {

            const userId =
                parseId(
                    req.params.userId
                );


            const messageId =
                parseId(
                    req.params.messageId
                );


            if (!userId || !messageId) {

                return error(
                    res,
                    "Identifiant invalide.",
                    400
                );

            }


            const user =
                await getMessageUserById(
                    userId
                );


            if (!user) {

                return error(
                    res,
                    "Utilisateur introuvable.",
                    404
                );

            }


            const message =
                await getCompleteMessageById(
                    messageId
                );


            if (!message) {

                return error(
                    res,
                    "Message introuvable.",
                    404
                );

            }


            const premium =
                isMessageUserPremium(
                    user
                );


            const visibleOfficial =
                message.type === "official" &&
                (
                    message.audience === "all" ||
                    (
                        premium &&
                        message.audience === "premium"
                    ) ||
                    (
                        !premium &&
                        message.audience === "standard"
                    )
                );


            const ownMessage =
                Number(
                    message.recipient_user_id
                ) === userId;


            if (
                !ownMessage &&
                !visibleOfficial
            ) {

                return error(
                    res,
                    "Ce message ne vous est pas destiné.",
                    403
                );

            }


            return res.json({

                success: true,

                message

            });


        } catch (err) {

            console.error(

                "GET message utilisateur :",

                err

            );


            return error(

                res,

                "Impossible de récupérer le message.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.16 UTILISATEUR — MARQUER MESSAGE COMME LU
============================================================ */

app.patch(

    "/api/utilisateurs/:userId/messages/:messageId/read",

    async function(req, res) {

        try {

            const userId =
                parseId(
                    req.params.userId
                );


            const messageId =
                parseId(
                    req.params.messageId
                );


            if (!userId || !messageId) {

                return error(
                    res,
                    "Identifiant invalide.",
                    400
                );

            }


            const user =
                await getMessageUserById(
                    userId
                );


            if (!user) {

                return error(
                    res,
                    "Utilisateur introuvable.",
                    404
                );

            }


            const premium =
                isMessageUserPremium(
                    user
                );


            const audience =
                premium
                    ? "premium"
                    : "standard";


            const result =
                await pool.query(

                    `
                    UPDATE messages

                    SET

                        status = 'read',

                        read_at =
                            COALESCE(
                                read_at,
                                CURRENT_TIMESTAMP
                            ),

                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE

                        id = $1

                        AND

                        (
                            recipient_user_id = $2

                            OR

                            (
                                type = 'official'

                                AND
                                (
                                    audience = 'all'
                                    OR audience = $3
                                )
                            )
                        )

                    RETURNING *
                    `,

                    [

                        messageId,

                        userId,

                        audience

                    ]

                );


            if (!result.rows.length) {

                return error(
                    res,
                    "Message introuvable ou non autorisé.",
                    404
                );

            }


            return res.json({

                success: true,

                message:
                    "Message marqué comme lu.",

                data:
                    result.rows[0]

            });


        } catch (err) {

            console.error(

                "PATCH message read :",

                err

            );


            return error(

                res,

                "Impossible de marquer le message comme lu.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.17 COMPATIBILITÉ — MARQUER LU
============================================================ */

app.patch(

    "/api/messages/:id/read",

    async function(req, res) {

        try {

            const id =
                parseId(
                    req.params.id
                );


            if (!id) {

                return error(
                    res,
                    "Identifiant invalide.",
                    400
                );

            }


            const result =
                await pool.query(

                    `
                    UPDATE messages

                    SET

                        status = 'read',

                        read_at =
                            COALESCE(
                                read_at,
                                CURRENT_TIMESTAMP
                            ),

                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE id = $1

                    RETURNING *
                    `,

                    [id]

                );


            if (!result.rows.length) {

                return error(
                    res,
                    "Message introuvable.",
                    404
                );

            }


            return res.json({

                success: true,

                message:
                    "Message marqué comme lu.",

                data:
                    result.rows[0]

            });


        } catch (err) {

            console.error(

                "PATCH /api/messages/:id/read :",

                err

            );


            return error(

                res,

                "Impossible de marquer le message comme lu.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.18 UTILISATEUR — RÉPONDRE
============================================================ */

async function processUserMessageReply(

    userId,

    messageId,

    content

) {

    const user =
        await getMessageUserById(
            userId
        );


    if (!user) {

        return {

            status: 404,

            error:
                "Utilisateur introuvable."

        };

    }


    if (
        user.blocked === true ||
        user.is_blocked === true
    ) {

        return {

            status: 403,

            error:
                "Votre compte est bloqué."

        };

    }


    const original =
        await getCompleteMessageById(
            messageId
        );


    if (!original) {

        return {

            status: 404,

            error:
                "Message introuvable."

        };

    }


    /*
       Impossible de répondre à un communiqué.
    */

    if (
        original.type === "official"
    ) {

        return {

            status: 403,

            error:
                "Vous ne pouvez pas répondre à un communiqué officiel."

        };

    }


    /*
       Seuls les messages envoyés par l'administration
       à cet utilisateur peuvent recevoir une réponse.
    */

    if (
        original.type !== "user"
    ) {

        return {

            status: 403,

            error:
                "Ce message ne peut pas recevoir de réponse."

        };

    }


    if (
        original.sender_type !== "admin"
    ) {

        return {

            status: 403,

            error:
                "Ce message n'accepte pas de réponse."

        };

    }


    if (
        Number(
            original.recipient_user_id
        ) !==
        Number(user.id)
    ) {

        return {

            status: 403,

            error:
                "Ce message ne vous est pas destiné."

        };

    }


    const cleanContent =
        String(
            content || ""
        ).trim();


    if (!cleanContent) {

        return {

            status: 400,

            error:
                "La réponse ne peut pas être vide."

        };

    }


    if (
        cleanContent.length > 10000
    ) {

        return {

            status: 400,

            error:
                "La réponse est trop longue."

        };

    }


    const result =
        await pool.query(

            `
            INSERT INTO messages
            (
                sender_type,
                sender_email,

                recipient_user_id,
                recipient_name,
                recipient_email,

                type,

                subject,
                content,

                priority,
                status,
                audience,

                read_at,

                created_at,
                updated_at
            )

            VALUES
            (
                'user',
                $1,

                $2,
                $3,
                $4,

                'user_reply',

                $5,
                $6,

                $7,
                'sent',
                'admin',

                NULL,

                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )

            RETURNING *
            `,

            [

                user.email ||
                    "",

                user.id,

                "BMJ SERVICE",

                ADMIN_EMAIL,

                `Réponse : ${original.subject || "Message"}`,

                cleanContent,

                original.priority ||
                    "normal"

            ]

        );


    const reply =
        result.rows[0];


    await safeMessageActivity(

        "REPONSE_UTILISATEUR",

        `Réponse reçue de ${user.nom || user.email || user.id} au message ${original.id}`,

        user.id,

        reply.id

    );


    return {

        status: 201,

        data:
            reply

    };

}


/* ============================================================
   24.19 UTILISATEUR — RÉPONDRE AVEC URL PRINCIPALE
============================================================ */

app.post(

    "/api/utilisateurs/:userId/messages/:messageId/repondre",

    async function(req, res) {

        try {

            const userId =
                parseId(
                    req.params.userId
                );


            const messageId =
                parseId(
                    req.params.messageId
                );


            const content =
                req.body?.content ??
                req.body?.message ??
                "";


            if (!userId || !messageId) {

                return error(
                    res,
                    "Identifiant invalide.",
                    400
                );

            }


            const result =
                await processUserMessageReply(

                    userId,

                    messageId,

                    content

                );


            if (result.error) {

                return error(

                    res,

                    result.error,

                    result.status

                );

            }


            return res.status(
                result.status
            ).json({

                success: true,

                message:
                    "Réponse envoyée avec succès.",

                data:
                    result.data

            });


        } catch (err) {

            console.error(

                "POST réponse utilisateur :",

                err

            );


            return error(

                res,

                "Impossible d'envoyer votre réponse.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.20 COMPATIBILITÉ — RÉPONSE UTILISATEUR
============================================================ */

app.post(

    "/api/messages/reply",

    async function(req, res) {

        try {

            const userId =
                parseId(

                    req.body?.user_id

                );


            const messageId =
                parseId(

                    req.body?.message_id

                );


            const content =
                req.body?.content ??
                req.body?.message ??
                "";


            if (!userId || !messageId) {

                return error(
                    res,
                    "Utilisateur ou message invalide.",
                    400
                );

            }


            const result =
                await processUserMessageReply(

                    userId,

                    messageId,

                    content

                );


            if (result.error) {

                return error(

                    res,

                    result.error,

                    result.status

                );

            }


            return res.status(
                result.status
            ).json({

                success: true,

                message:
                    "Réponse envoyée avec succès.",

                data:
                    result.data

            });


        } catch (err) {

            console.error(

                "POST /api/messages/reply :",

                err

            );


            return error(

                res,

                "Impossible d'envoyer la réponse.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.21 ADMIN — VOIR UNIQUEMENT LES RÉPONSES UTILISATEURS
============================================================ */

app.get(

    "/api/messages/reponses",

    adminAuth,

    async function(req, res) {

        try {

            const result =
                await pool.query(

                    `
                    SELECT

                        m.*,

                        u.nom AS user_nom_db,
                        u.email AS user_email_db,
                        u.telephone AS user_telephone_db,

                        u.premium AS user_premium_db,
                        u.is_premium AS user_is_premium_db

                    FROM messages m

                    LEFT JOIN users u
                        ON u.id =
                           m.recipient_user_id

                    WHERE m.type =
                          'user_reply'

                    ORDER BY

                        m.created_at DESC,
                        m.id DESC

                    LIMIT 1000
                    `

                );


            return res.json({

                success: true,

                messages:
                    result.rows,

                responses:
                    result.rows,

                count:
                    result.rows.length

            });


        } catch (err) {

            console.error(

                "GET /api/messages/reponses :",

                err

            );


            return error(

                res,

                "Impossible de récupérer les réponses utilisateurs.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.22 ADMIN — VOIR LES MESSAGES D'UN UTILISATEUR
============================================================ */

app.get(

    "/api/admin/messages/user/:userId",

    adminAuth,

    async function(req, res) {

        try {

            const userId =
                parseId(
                    req.params.userId
                );


            if (!userId) {

                return error(
                    res,
                    "Identifiant utilisateur invalide.",
                    400
                );

            }


            const user =
                await getMessageUserById(
                    userId
                );


            if (!user) {

                return error(
                    res,
                    "Utilisateur introuvable.",
                    404
                );

            }


            const result =
                await pool.query(

                    `
                    SELECT *

                    FROM messages

                    WHERE
                        recipient_user_id = $1

                        OR

                        (
                            sender_type = 'user'
                            AND
                            recipient_email =
                                $2
                        )

                    ORDER BY

                        created_at ASC,
                        id ASC
                    `,

                    [

                        userId,

                        ADMIN_EMAIL

                    ]

                );


            return res.json({

                success: true,

                user: {

                    id:
                        user.id,

                    nom:
                        user.nom,

                    email:
                        user.email,

                    premium:
                        isMessageUserPremium(
                            user
                        )

                },

                messages:
                    result.rows,

                count:
                    result.rows.length

            });


        } catch (err) {

            console.error(

                "GET messages utilisateur admin :",

                err

            );


            return error(

                res,

                "Impossible de récupérer la conversation.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   24.23 ADMIN — SUPPRIMER UNE RÉPONSE
   Même route DELETE que les autres messages.
============================================================ */


/* ============================================================
   24.24 ROUTES MESSAGERIE
============================================================ */

console.log(
    "✓ Nouvelle messagerie BMJ SERVICE chargée."
);

/* ============================================================
   25. DASHBOARD ADMIN
============================================================ */

app.get(

    "/api/admin/dashboard",

    adminAuth,

    async function(req, res) {

        try {

            const result =
                await pool.query(

                    `
                    SELECT

                        (
                            SELECT COUNT(*)
                            FROM users
                        )::int AS utilisateurs,

                        (
                            SELECT COUNT(*)
                            FROM users
                            WHERE premium=true
                               OR is_premium=true
                        )::int AS premium,

                        (
                            SELECT COUNT(*)
                            FROM users
                            WHERE blocked=true
                               OR is_blocked=true
                        )::int AS bloques,

                        (
                            SELECT COUNT(*)
                            FROM paiements
                        )::int AS paiements,

                        (
                            SELECT COUNT(*)
                            FROM paiements
                            WHERE LOWER(status)
                            IN (
                                'pending',
                                'en_attente',
                                'attente'
                            )
                        )::int AS en_attente,

                        (
                            SELECT COUNT(*)
                            FROM paiements
                            WHERE LOWER(status)
                            = 'validated'
                        )::int AS valides,

                        (
                            SELECT COUNT(*)
                            FROM paiements
                            WHERE LOWER(status)
                            = 'refused'
                        )::int AS refuses,

                        (
                            SELECT COUNT(*)
                            FROM demandes_paiement
                        )::int AS demandes_paiement,

                        (
                            SELECT COUNT(*)
                            FROM demandes_paiement
                            WHERE LOWER(
                                COALESCE(status,'pending')
                            )='pending'
                        )::int AS demandes_en_attente,

                        (
                            SELECT COUNT(*)
                            FROM demandes_paiement
                            WHERE LOWER(
                                COALESCE(status,'pending')
                            )='validated'
                        )::int AS demandes_validees,

                        (
                            SELECT COUNT(*)
                            FROM demandes_paiement
                            WHERE LOWER(
                                COALESCE(status,'pending')
                            )='refused'
                        )::int AS demandes_refusees,

                        (
                            SELECT COALESCE(
                                SUM(amount),
                                0
                            )
                            FROM paiements
                            WHERE LOWER(status)
                            = 'validated'
                        ) AS revenus,

                        (
                            SELECT COUNT(*)
                            FROM messages
                        )::int AS messages,

                        (
                            SELECT COUNT(*)
                            FROM messages
                            WHERE LOWER(
                                COALESCE(status,'sent')
                            )='sent'
                        )::int AS messages_envoyes

                    `

                );


            const recent =
                await pool.query(

                    `
                    SELECT

                        p.*,

                        u.nom
                            AS user_nom_db,

                        u.email
                            AS user_email_db,

                        u.telephone
                            AS user_telephone_db

                    FROM paiements p

                    LEFT JOIN users u
                        ON u.id=p.user_id

                    ORDER BY
                        p.created_at DESC

                    LIMIT 10
                    `

                );


            const recentDemandes =
                await pool.query(

                    `
                    SELECT

                        d.*,

                        u.nom
                            AS user_nom,

                        u.email
                            AS user_email,

                        u.telephone
                            AS user_telephone

                    FROM demandes_paiement d

                    LEFT JOIN users u
                        ON u.id=d.user_id

                    ORDER BY
                        d.created_at DESC

                    LIMIT 10
                    `

                );


            const stats =
                result.rows[0];


            return success(

                res,

                {

                    utilisateurs:
                        Number(
                            stats.utilisateurs
                        ),

                    users:
                        Number(
                            stats.utilisateurs
                        ),

                    premium:
                        Number(
                            stats.premium
                        ),

                    bloques:
                        Number(
                            stats.bloques
                        ),

                    utilisateurs_bloques:
                        Number(
                            stats.bloques
                        ),

                    paiements:
                        Number(
                            stats.paiements
                        ),

                    pending:
                        Number(
                            stats.en_attente
                        ),

                    paiements_en_attente:
                        Number(
                            stats.en_attente
                        ),

                    valides:
                        Number(
                            stats.valides
                        ),

                    refuses:
                        Number(
                            stats.refuses
                        ),

                    revenus:
                        stats.revenus,

                    demandes_paiement:
                        Number(
                            stats.demandes_paiement
                        ),

                    demandes_en_attente:
                        Number(
                            stats.demandes_en_attente
                        ),

                    demandes_validees:
                        Number(
                            stats.demandes_validees
                        ),

                    demandes_refusees:
                        Number(
                            stats.demandes_refusees
                        ),

                    messages:
                        Number(
                            stats.messages
                        ),

                    messages_envoyes:
                        Number(
                            stats.messages_envoyes
                        ),

                    paiements_recents:
                        recent.rows,

                    demandes_paiement_recentes:
                        recentDemandes.rows

                },

                "Tableau de bord chargé"

            );

        } catch (err) {

            return error(

                res,

                "Impossible de charger le tableau de bord.",

                500,

                err.message

            );

        }

    }

);
/* ============================================================
   25. LISTE UTILISATEURS ADMIN
============================================================ */

async function getAdminUsers(req, res) {

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
                    photo,
                    premium,
                    is_premium,
                    premium_until,
                    blocked,
                    is_blocked,
                    created_at,
                    updated_at

                FROM users

                ORDER BY
                    created_at DESC
                `

            );


        return success(

            res,

            result.rows,

            "Utilisateurs chargés"

        );

    } catch (err) {

        return error(

            res,

            "Impossible de charger les utilisateurs.",

            500,

            err.message

        );

    }

}


app.get(

    "/api/admin/utilisateurs",

    adminAuth,

    getAdminUsers

);


app.get(

    "/api/admin/users",

    adminAuth,

    getAdminUsers

);


/* ============================================================
   26. UTILISATEURS PUBLICS
============================================================ */

async function getUsersPublic(req, res) {

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
                    photo,
                    premium,
                    is_premium,
                    premium_until,
                    blocked,
                    is_blocked,
                    created_at

                FROM users

                ORDER BY
                    created_at DESC
                `

            );


        return success(

            res,

            result.rows,

            "Utilisateurs chargés"

        );

    } catch (err) {

        return error(

            res,

            "Impossible de charger les utilisateurs.",

            500,

            err.message

        );

    }

}


app.get(
    "/api/utilisateurs",
    getUsersPublic
);


app.get(
    "/api/users",
    getUsersPublic
);


/* ============================================================
   27. UTILISATEUR PAR ID
============================================================ */

async function getUserById(req, res) {

    try {

        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            return error(

                res,

                "ID utilisateur invalide.",

                400

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
                    photo,
                    premium,
                    is_premium,
                    premium_until,
                    blocked,
                    is_blocked,
                    created_at,
                    updated_at

                FROM users

                WHERE id=$1
                `,

                [id]

            );


        if (!result.rows.length) {

            return error(

                res,

                "Utilisateur introuvable.",

                404

            );

        }


        return success(

            res,

            result.rows[0]

        );

    } catch (err) {

        return error(

            res,

            "Erreur utilisateur.",

            500,

            err.message

        );

    }

}


app.get(
    "/api/utilisateurs/:id",
    getUserById
);


app.get(
    "/api/users/:id",
    getUserById
);


/* ============================================================
   28. CRÉATION UTILISATEUR
============================================================ */

app.post(

    "/api/utilisateurs",

    registerUser

);


app.post(

    "/api/users",

    registerUser

);


/* ============================================================
   29. MODIFICATION UTILISATEUR
============================================================ */

async function updateUser(req, res) {

    try {

        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            return error(

                res,

                "ID utilisateur invalide.",

                400

            );

        }


        const body =
            req.body || {};


        const nom =
            body.nom !== undefined
                ? body.nom
                : null;


        const email =
            body.email !== undefined
                ? normalizeEmail(
                    body.email
                )
                : null;


        const telephone =
            body.telephone !== undefined
                ? body.telephone
                : null;


        const domaine =
            body.domaine !== undefined
                ? body.domaine
                : null;


        const photo =
            body.photo !== undefined
                ? body.photo
                : null;


        if (email) {

            const emailCheck =
                await pool.query(

                    `
                    SELECT id
                    FROM users
                    WHERE LOWER(email)=LOWER($1)
                    AND id<>$2
                    LIMIT 1
                    `,

                    [
                        email,
                        id
                    ]

                );


            if (
                emailCheck.rows.length
            ) {

                return error(

                    res,

                    "Cette adresse email est déjà utilisée.",

                    409

                );

            }

        }


        const result =
            await pool.query(

                `
                UPDATE users

                SET

                    nom =
                        COALESCE($1,nom),

                    email =
                        COALESCE($2,email),

                    telephone =
                        COALESCE($3,telephone),

                    domaine =
                        COALESCE($4,domaine),

                    photo =
                        COALESCE($5,photo),

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id=$6

                RETURNING

                    id,
                    nom,
                    email,
                    telephone,
                    domaine,
                    photo,
                    premium,
                    is_premium,
                    premium_until,
                    blocked,
                    is_blocked,
                    created_at,
                    updated_at
                `,

                [

                    nom,
                    email,
                    telephone,
                    domaine,
                    photo,
                    id

                ]

            );


        if (!result.rows.length) {

            return error(

                res,

                "Utilisateur introuvable.",

                404

            );

        }


        await logActivity(

            "UPDATE_USER",

            `Utilisateur ${id} modifié`,

            id

        );


        return success(

            res,

            result.rows[0],

            "Utilisateur modifié"

        );

    } catch (err) {

        return error(

            res,

            "Impossible de modifier l'utilisateur.",

            500,

            err.message

        );

    }

}


app.put(

    "/api/utilisateurs/:id",

    adminAuth,

    updateUser

);


app.patch(

    "/api/utilisateurs/:id",

    adminAuth,

    updateUser

);


/* ============================================================
   30. SUPPRESSION UTILISATEUR
============================================================ */

async function deleteUser(req, res) {

    try {

        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            return error(

                res,

                "ID utilisateur invalide.",

                400

            );

        }


        await pool.query(

            `
            UPDATE paiements

            SET user_id=NULL

            WHERE user_id=$1
            `,

            [id]

        );


        /*
           Les nouvelles demandes de paiement
           restent conservées dans la base,
           mais leur user_id est retiré.
        */

        await pool.query(

            `
            UPDATE demandes_paiement

            SET user_id=NULL

            WHERE user_id=$1
            `,

            [id]

        );


        const result =
            await pool.query(

                `
                DELETE FROM users

                WHERE id=$1

                RETURNING id
                `,

                [id]

            );


        if (!result.rows.length) {

            return error(

                res,

                "Utilisateur introuvable.",

                404

            );

        }


        await logActivity(

            "DELETE_USER",

            `Utilisateur ${id} supprimé`,

            id

        );


        return success(

            res,

            result.rows[0],

            "Utilisateur supprimé"

        );

    } catch (err) {

        return error(

            res,

            "Impossible de supprimer l'utilisateur.",

            500,

            err.message

        );

    }

}


app.delete(

    "/api/utilisateurs/:id",

    adminAuth,

    deleteUser

);


/* ============================================================
   31. LISTE DES PAIEMENTS EXISTANTS
============================================================ */

async function getPayments(req, res) {

    try {

        const result =
            await pool.query(

                `
                SELECT

                    p.*,

                    u.nom
                        AS user_nom_db,

                    u.email
                        AS user_email_db,

                    u.telephone
                        AS user_telephone_db

                FROM paiements p

                LEFT JOIN users u
                    ON u.id=p.user_id

                ORDER BY
                    p.created_at DESC
                `

            );


        const data =
            result.rows.map(

                function(payment) {

                    return {

                        ...payment,

                        nom:
                            payment.nom ||
                            payment.user_nom_db ||
                            null,

                        email:
                            payment.email ||
                            payment.user_email_db ||
                            null,

                        telephone:
                            payment.telephone ||
                            payment.user_telephone_db ||
                            null,

                        amount:
                            payment.amount ??
                            payment.montant ??
                            0,

                        montant:
                            payment.montant ??
                            payment.amount ??
                            0,

                        method:
                            payment.method ||
                            payment.methode ||
                            null,

                        methode:
                            payment.methode ||
                            payment.method ||
                            null,

                        reference:
                            payment.reference ||
                            payment.transaction_id ||
                            null,

                        transaction_id:
                            payment.transaction_id ||
                            payment.reference ||
                            null,

                        proof:
                            payment.proof ||
                            payment.preuve ||
                            null,

                        preuve:
                            payment.preuve ||
                            payment.proof ||
                            null,

                        status:
                            payment.status ||
                            "pending"

                    };

                }

            );


        return success(

            res,

            data,

            "Paiements chargés"

        );

    } catch (err) {

        return error(

            res,

            "Impossible de charger les paiements.",

            500,

            err.message

        );

    }

}


app.get(

    "/api/paiements",

    getPayments

);


app.get(

    "/api/admin/paiements",

    adminAuth,

    getPayments

);


app.get(

    "/api/admin/payments",

    adminAuth,

    getPayments

);


/* ============================================================
   32. PAIEMENT PAR ID
============================================================ */

async function getPaymentById(req, res) {

    try {

        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            return error(

                res,

                "ID paiement invalide.",

                400

            );

        }


        const result =
            await pool.query(

                `
                SELECT

                    p.*,

                    u.nom
                        AS user_nom_db,

                    u.email
                        AS user_email_db,

                    u.telephone
                        AS user_telephone_db

                FROM paiements p

                LEFT JOIN users u
                    ON u.id=p.user_id

                WHERE p.id=$1
                `,

                [id]

            );


        if (!result.rows.length) {

            return error(

                res,

                "Paiement introuvable.",

                404

            );

        }


        return success(

            res,

            result.rows[0],

            "Paiement trouvé"

        );

    } catch (err) {

        return error(

            res,

            "Erreur paiement.",

            500,

            err.message

        );

    }

}


app.get(

    "/api/paiements/:id",

    getPaymentById

);


/* ============================================================
   33. CRÉER PAIEMENT EXISTANT
============================================================ */

async function createPayment(req, res) {

    try {

        const body =
            req.body || {};


        const userId =
            body.user_id ||
            body.userId ||
            null;


        const amount =
            Number(

                body.amount ??
                body.montant ??
                0

            );


        if (

            !Number.isFinite(amount) ||
            amount < 0

        ) {

            return error(

                res,

                "Montant du paiement invalide.",

                400

            );

        }


        const currency =
            body.currency ||
            "USD";


        const method =
            body.method ||
            body.methode ||
            body.mode_paiement ||
            null;


        const reference =
            body.reference ||
            body.transaction_id ||
            body.transactionId ||
            null;


        const proof =
            body.preuve ||
            body.proof ||
            body.image ||
            null;


        let user =
            null;


        if (userId) {

            const userResult =
                await pool.query(

                    `
                    SELECT *
                    FROM users
                    WHERE id=$1
                    `,

                    [userId]

                );


            if (
                !userResult.rows.length
            ) {

                return error(

                    res,

                    "Utilisateur associé introuvable.",

                    404

                );

            }


            user =
                userResult.rows[0];

        }


        const nom =
            body.nom ||
            (user && user.nom) ||
            null;


        const email =
            body.email ||
            (user && user.email) ||
            null;


        const telephone =
            body.telephone ||
            (user && user.telephone) ||
            null;


        const premiumDays =
            Number(

                body.premium_days ??
                body.premiumDays ??
                30

            );


        if (

            !Number.isInteger(
                premiumDays
            ) ||

            premiumDays <= 0

        ) {

            return error(

                res,

                "Nombre de jours Premium invalide.",

                400

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
                    method,
                    reference,
                    transaction_id,
                    preuve,
                    proof,
                    status,
                    premium_days,
                    notes
                )

                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $5,
                    $6,
                    $7,
                    $7,
                    $8,
                    $8,
                    $9,
                    $9,
                    'pending',
                    $10,
                    $11
                )

                RETURNING *
                `,

                [

                    userId,
                    nom,
                    email,
                    telephone,
                    amount,
                    currency,
                    method,
                    reference,
                    proof,
                    premiumDays,
                    body.notes || null

                ]

            );


        const payment =
            result.rows[0];


        await logActivity(

            "CREATE_PAYMENT",

            `Paiement ${payment.id} créé pour ${email || "utilisateur"}`,

            userId,

            payment.id

        );


        return success(

            res,

            payment,

            "Paiement enregistré avec succès"

        );

    } catch (err) {

        return error(

            res,

            "Impossible d'enregistrer le paiement.",

            500,

            err.message

        );

    }

}


app.post(

    "/api/paiements",

    createPayment

);


app.post(

    "/api/paiements/manual",

    adminAuth,

    createPayment

);


app.post(

    "/api/admin/paiements/manual",

    adminAuth,

    createPayment

);


/* ============================================================
   34. VALIDATION PAIEMENT EXISTANT
============================================================ */

async function validatePayment(req, res) {

    const client =
        await pool.connect();


    try {

        await client.query(
            "BEGIN"
        );


        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            await client.query(
                "ROLLBACK"
            );


            return error(

                res,

                "ID paiement invalide.",

                400

            );

        }


        const paymentResult =
            await client.query(

                `
                SELECT *
                FROM paiements
                WHERE id=$1
                FOR UPDATE
                `,

                [id]

            );


        if (
            !paymentResult.rows.length
        ) {

            await client.query(
                "ROLLBACK"
            );


            return error(

                res,

                "Paiement introuvable.",

                404

            );

        }


        const payment =
            paymentResult.rows[0];


        const status =
            String(
                payment.status || ""
            ).toLowerCase();


        if (
            status === "validated"
        ) {

            await client.query(
                "ROLLBACK"
            );


            return error(

                res,

                "Ce paiement est déjà validé.",

                409

            );

        }


        if (
            status === "refused"
        ) {

            await client.query(
                "ROLLBACK"
            );


            return error(

                res,

                "Ce paiement a déjà été refusé.",

                409

            );

        }


        const userId =
            payment.user_id;


        if (!userId) {

            await client.query(
                "ROLLBACK"
            );


            return error(

                res,

                "Ce paiement n'est associé à aucun utilisateur.",

                400

            );

        }


        const userResult =
            await client.query(

                `
                SELECT *
                FROM users
                WHERE id=$1
                FOR UPDATE
                `,

                [userId]

            );


        if (
            !userResult.rows.length
        ) {

            await client.query(
                "ROLLBACK"
            );


            return error(

                res,

                "Utilisateur associé introuvable.",

                404

            );

        }


        const user =
            userResult.rows[0];


        const days =
            Number(
                payment.premium_days ||
                30
            );


        const now =
            new Date();


        let baseDate =
            now;


        if (
            user.premium_until
        ) {

            const currentUntil =
                new Date(
                    user.premium_until
                );


            if (
                currentUntil > now
            ) {

                baseDate =
                    currentUntil;

            }

        }


        const newPremiumUntil =
            new Date(
                baseDate
            );


        newPremiumUntil.setDate(

            newPremiumUntil.getDate() +
            days

        );


        await client.query(

            `
            UPDATE users

            SET

                premium=true,

                is_premium=true,

                premium_until=$1,

                updated_at=CURRENT_TIMESTAMP

            WHERE id=$2
            `,

            [

                newPremiumUntil,
                userId

            ]

        );


        const updatedPayment =
            await client.query(

                `
                UPDATE paiements

                SET

                    status='validated',

                    validated_at=
                        CURRENT_TIMESTAMP,

                    updated_at=
                        CURRENT_TIMESTAMP

                WHERE id=$1

                RETURNING *
                `,

                [id]

            );


        await client.query(
            "COMMIT"
        );


        await logActivity(

            "VALIDATE_PAYMENT",

            `Paiement ${id} validé - Premium activé`,

            userId,

            id

        );


        return success(

            res,

            {

                payment:
                    updatedPayment.rows[0],

                user_id:
                    userId,

                premium:
                    true,

                is_premium:
                    true,

                premium_until:
                    newPremiumUntil,

                premium_days:
                    days

            },

            "Paiement validé et Premium activé"

        );

    } catch (err) {

        try {

            await client.query(
                "ROLLBACK"
            );

        } catch (_) {}


        return error(

            res,

            "Impossible de valider le paiement.",

            500,

            err.message

        );

    } finally {

        client.release();

    }

}


app.patch(

    "/api/paiements/:id/valider",

    adminAuth,

    validatePayment

);


app.patch(

    "/api/admin/paiements/:id/valider",

    adminAuth,

    validatePayment

);


/* ============================================================
   35. REFUS PAIEMENT EXISTANT
============================================================ */

async function refusePayment(req, res) {

    try {

        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            return error(

                res,

                "ID paiement invalide.",

                400

            );

        }


        const reason =
            req.body.reason ||
            req.body.motif ||
            req.body.refusal_reason ||
            "Paiement refusé par l'administrateur";


        const result =
            await pool.query(

                `
                UPDATE paiements

                SET

                    status='refused',

                    refusal_reason=$1,

                    refused_at=
                        CURRENT_TIMESTAMP,

                    updated_at=
                        CURRENT_TIMESTAMP

                WHERE id=$2

                AND LOWER(
                    COALESCE(status,'pending')
                ) <> 'validated'

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
                    SELECT id,status
                    FROM paiements
                    WHERE id=$1
                    `,

                    [id]

                );


            if (!check.rows.length) {

                return error(

                    res,

                    "Paiement introuvable.",

                    404

                );

            }


            return error(

                res,

                "Un paiement déjà validé ne peut pas être refusé.",

                409

            );

        }


        const payment =
            result.rows[0];


        await logActivity(

            "REFUSE_PAYMENT",

            `Paiement ${id} refusé : ${reason}`,

            payment.user_id,

            id

        );


        return success(

            res,

            payment,

            "Paiement refusé"

        );

    } catch (err) {

        return error(

            res,

            "Impossible de refuser le paiement.",

            500,

            err.message

        );

    }

}


app.patch(

    "/api/paiements/:id/refuser",

    adminAuth,

    refusePayment

);


app.patch(

    "/api/admin/paiements/:id/refuser",

    adminAuth,

    refusePayment

);


/* ============================================================
   36. MODIFIER PAIEMENT EXISTANT
============================================================ */

async function updatePayment(req, res) {

    try {

        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            return error(

                res,

                "ID paiement invalide.",

                400

            );

        }


        const body =
            req.body || {};


        const status =
            body.status !== undefined
                ? body.status
                : null;


        const reference =
            body.reference ||
            body.transaction_id ||
            body.transactionId ||
            null;


        const method =
            body.method ||
            body.methode ||
            body.mode_paiement ||
            null;


        const notes =
            body.notes !== undefined
                ? body.notes
                : null;


        const refusalReason =
            body.refusal_reason ||
            body.reason ||
            body.motif ||
            null;


        const amount =
            body.amount ??
            body.montant ??
            null;


        const currency =
            body.currency ||
            null;


        const result =
            await pool.query(

                `
                UPDATE paiements

                SET

                    status =
                        COALESCE(
                            $1,
                            status
                        ),

                    reference =
                        COALESCE(
                            $2,
                            reference
                        ),

                    transaction_id =
                        COALESCE(
                            $2,
                            transaction_id
                        ),

                    methode =
                        COALESCE(
                            $3,
                            methode
                        ),

                    method =
                        COALESCE(
                            $3,
                            method
                        ),

                    amount =
                        COALESCE(
                            $4,
                            amount
                        ),

                    montant =
                        COALESCE(
                            $4,
                            montant
                        ),

                    currency =
                        COALESCE(
                            $5,
                            currency
                        ),

                    notes =
                        COALESCE(
                            $6,
                            notes
                        ),

                    refusal_reason =
                        COALESCE(
                            $7,
                            refusal_reason
                        ),

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id=$8

                RETURNING *
                `,

                [

                    status,
                    reference,
                    method,
                    amount,
                    currency,
                    notes,
                    refusalReason,
                    id

                ]

            );


        if (!result.rows.length) {

            return error(

                res,

                "Paiement introuvable.",

                404

            );

        }


        await logActivity(

            "UPDATE_PAYMENT",

            `Paiement ${id} modifié`,

            result.rows[0].user_id,

            id

        );


        return success(

            res,

            result.rows[0],

            "Paiement modifié"

        );

    } catch (err) {

        return error(

            res,

            "Impossible de modifier le paiement.",

            500,

            err.message

        );

    }

}


app.put(

    "/api/paiements/:id",

    adminAuth,

    updatePayment

);


app.patch(

    "/api/paiements/:id",

    adminAuth,

    updatePayment

);


/* ============================================================
   37. SUPPRIMER PAIEMENT EXISTANT
============================================================ */

app.delete(

    "/api/paiements/:id",

    adminAuth,

    async function(req, res) {

        try {

            const id =
                parseId(
                    req.params.id
                );


            if (!id) {

                return error(

                    res,

                    "ID paiement invalide.",

                    400

                );

            }


            const result =
                await pool.query(

                    `
                    DELETE FROM paiements

                    WHERE id=$1

                    RETURNING
                        id,
                        user_id
                    `,

                    [id]

                );


            if (!result.rows.length) {

                return error(

                    res,

                    "Paiement introuvable.",

                    404

                );

            }


            await logActivity(

                "DELETE_PAYMENT",

                `Paiement ${id} supprimé`,

                null,

                id

            );


            return success(

                res,

                result.rows[0],

                "Paiement supprimé"

            );

        } catch (err) {

            return error(

                res,

                "Impossible de supprimer le paiement.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   38. PREMIUM MANUEL
============================================================ */

app.patch(

    "/api/admin/users/:id/premium",

    adminAuth,

    async function(req, res) {

        try {

            const id =
                parseId(
                    req.params.id
                );


            if (!id) {

                return error(

                    res,

                    "ID utilisateur invalide.",

                    400

                );

            }


            const enabled =
                req.body.enabled !== undefined

                    ? getBoolean(
                        req.body.enabled
                    )

                    : true;


            const days =
                Number(

                    req.body.days ??
                    req.body.premium_days ??
                    30

                );


            if (

                enabled &&

                (

                    !Number.isInteger(days) ||
                    days <= 0

                )

            ) {

                return error(

                    res,

                    "Nombre de jours Premium invalide.",

                    400

                );

            }


            let premiumUntil =
                null;


            if (enabled) {

                const existing =
                    await pool.query(

                        `
                        SELECT premium_until

                        FROM users

                        WHERE id=$1
                        `,

                        [id]

                    );


                if (
                    !existing.rows.length
                ) {

                    return error(

                        res,

                        "Utilisateur introuvable.",

                        404

                    );

                }


                const now =
                    new Date();


                let base =
                    now;


                if (
                    existing.rows[0]
                        .premium_until
                ) {

                    const current =
                        new Date(

                            existing.rows[0]
                                .premium_until

                        );


                    if (
                        current > now
                    ) {

                        base =
                            current;

                    }

                }


                premiumUntil =
                    new Date(base);


                premiumUntil.setDate(

                    premiumUntil.getDate() +
                    days

                );

            }


            const result =
                await pool.query(

                    `
                    UPDATE users

                    SET

                        premium=$1,

                        is_premium=$1,

                        premium_until=$2,

                        updated_at=
                            CURRENT_TIMESTAMP

                    WHERE id=$3

                    RETURNING

                        id,
                        nom,
                        email,
                        premium,
                        is_premium,
                        premium_until
                    `,

                    [

                        enabled,
                        premiumUntil,
                        id

                    ]

                );


            if (!result.rows.length) {

                return error(

                    res,

                    "Utilisateur introuvable.",

                    404

                );

            }


            await logActivity(

                enabled
                    ? "ENABLE_PREMIUM"
                    : "DISABLE_PREMIUM",

                enabled
                    ? `Premium activé pour utilisateur ${id} pendant ${days} jours`
                    : `Premium désactivé pour utilisateur ${id}`,

                id

            );


            return success(

                res,

                {

                    ...result.rows[0],

                    premium_days:
                        enabled
                            ? days
                            : 0

                },

                enabled
                    ? "Premium activé"
                    : "Premium désactivé"

            );

        } catch (err) {

            return error(

                res,

                "Impossible de modifier Premium.",

                500,

                err.message

            );

        }

    }

);


/* ============================================================
   39. BLOQUER / DÉBLOQUER UTILISATEUR
============================================================ */

app.patch(

    "/api/admin/users/:id/block",

    adminAuth,

    async function(req, res) {

        try {

            const id =
                parseId(
                    req.params.id
                );


            if (!id) {

                return error(

                    res,

                    "ID utilisateur invalide.",

                    400

                );

            }


            const blocked =
                req.body.blocked !== undefined

                    ? getBoolean(
                        req.body.blocked
                    )

                    : true;


            const result =
                await pool.query(

                    `
                    UPDATE users

                    SET

                        blocked=$1,

                        is_blocked=$1,

                        updated_at=
                            CURRENT_TIMESTAMP

                    WHERE id=$2

                    RETURNING

                        id,
                        nom,
                        email,
                        blocked,
                        is_blocked
                    `,

                    [

                        blocked,
                        id

                    ]

                );


            if (!result.rows.length) {

                return error(

                    res,

                    "Utilisateur introuvable.",

                    404

                );

            }


            await logActivity(

                blocked
                    ? "BLOCK_USER"
                    : "UNBLOCK_USER",

                blocked
                    ? `Utilisateur ${id} bloqué`
                    : `Utilisateur ${id} débloqué`,

                id

            );


            return success(

                res,

                result.rows[0],

                blocked
                    ? "Utilisateur bloqué"
                    : "Utilisateur débloqué"

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

);


/* ============================================================
   40. NOUVELLE FONCTIONNALITÉ
   DEMANDE DE PAIEMENT UTILISATEUR
============================================================ */

/*
   IMPORTANT :

   Cette route est complètement indépendante
   de /api/paiements.

   La page utilisateur doit envoyer :

   POST /api/demandes-paiement

   BODY :

   {
       "user_id": 12,
       "telephone_paiement": "0991234567",
       "reference_paiement": "ABC123456"
   }

   Rien d'autre n'est nécessaire.
*/


async function createPaymentRequest(req, res) {

    try {

        const body =
            req.body || {};


        const userId =
            parseId(

                body.user_id ??
                body.userId

            );


        const telephonePaiement =
            String(

                body.telephone_paiement ??
                body.telephonePaiement ??
                body.numero_paiement ??
                body.numeroPaiement ??
                ""

            ).trim();


        const referencePaiement =
            String(

                body.reference_paiement ??
                body.referencePaiement ??
                body.reference ??
                ""

            ).trim();


        /* ====================================================
           VALIDATION
        ==================================================== */

        if (!userId) {

            return error(

                res,

                "Utilisateur invalide.",

                400

            );

        }


        if (!telephonePaiement) {

            return error(

                res,

                "Le numéro ayant effectué le paiement est obligatoire.",

                400

            );

        }


        if (!referencePaiement) {

            return error(

                res,

                "La référence du paiement est obligatoire.",

                400

            );

        }


        if (

            telephonePaiement.length < 6 ||
            telephonePaiement.length > 100

        ) {

            return error(

                res,

                "Numéro de paiement invalide.",

                400

            );

        }


        if (

            referencePaiement.length < 2 ||
            referencePaiement.length > 255

        ) {

            return error(

                res,

                "Référence de paiement invalide.",

                400

            );

        }


        /* ====================================================
           VÉRIFICATION UTILISATEUR
        ==================================================== */

        const userResult =
            await pool.query(

                `
                SELECT

                    id,
                    nom,
                    email,
                    telephone,
                    premium,
                    is_premium,
                    premium_until,
                    blocked,
                    is_blocked

                FROM users

                WHERE id=$1

                LIMIT 1
                `,

                [userId]

            );


        if (!userResult.rows.length) {

            return error(

                res,

                "Utilisateur introuvable.",

                404

            );

        }


        const user =
            userResult.rows[0];


        if (

            user.blocked === true ||
            user.is_blocked === true

        ) {

            return error(

                res,

                "Votre compte est bloqué.",

                403

            );

        }


        /* ====================================================
           EMPÊCHER UNE DOUBLE DEMANDE EN ATTENTE
        ==================================================== */

        const pending =
            await pool.query(

                `
                SELECT id

                FROM demandes_paiement

                WHERE user_id=$1

                AND LOWER(
                    COALESCE(status,'pending')
                )='pending'

                LIMIT 1
                `,

                [userId]

            );


        if (pending.rows.length) {

            return error(

                res,

                "Vous avez déjà une demande de paiement en attente.",

                409,

                {

                    demande_id:
                        pending.rows[0].id

                }

            );

        }


        /* ====================================================
           EMPÊCHER UNE RÉFÉRENCE DÉJÀ UTILISÉE
        ==================================================== */

        const referenceUsed =
            await pool.query(

                `
                SELECT id

                FROM demandes_paiement

                WHERE LOWER(
                    reference_paiement
                )=LOWER($1)

                LIMIT 1
                `,

                [referencePaiement]

            );


        if (
            referenceUsed.rows.length
        ) {

            return error(

                res,

                "Cette référence de paiement a déjà été utilisée.",

                409

            );

        }


        /* ====================================================
           CRÉATION
        ==================================================== */

        const result =
            await pool.query(

                `
                INSERT INTO demandes_paiement
                (
                    user_id,
                    telephone_paiement,
                    reference_paiement,
                    status
                )

                VALUES
                (
                    $1,
                    $2,
                    $3,
                    'pending'
                )

                RETURNING
                    id,
                    user_id,
                    telephone_paiement,
                    reference_paiement,
                    status,
                    created_at,
                    updated_at
                `,

                [

                    userId,
                    telephonePaiement,
                    referencePaiement

                ]

            );


        const demande =
            result.rows[0];


        await logActivity(

            "CREATE_PAYMENT_REQUEST",

            `Demande de paiement ${demande.id} créée pour utilisateur ${userId}`,

            userId

        );


        return success(

            res,

            {

                ...demande,

                user: {

                    id:
                        user.id,

                    nom:
                        user.nom,

                    email:
                        user.email

                }

            },

            "Votre demande de paiement a été enregistrée."

        );

    } catch (err) {

        return error(

            res,

            "Impossible d'enregistrer la demande de paiement.",

            500,

            err.message

        );

    }

}


/* ============================================================
   ROUTE PRINCIPALE DEMANDE PAIEMENT
============================================================ */

app.post(

    "/api/demandes-paiement",

    createPaymentRequest

);


/* ============================================================
   41. LISTE DEMANDES DE PAIEMENT
============================================================ */

async function getPaymentRequests(req, res) {

    try {

        const result =
            await pool.query(

                `
                SELECT

                    d.id,

                    d.user_id,

                    d.telephone_paiement,

                    d.reference_paiement,

                    d.status,

                    d.refusal_reason,

                    d.created_at,

                    d.validated_at,

                    d.refused_at,

                    d.updated_at,

                    u.nom
                        AS user_nom,

                    u.email
                        AS user_email,

                    u.telephone
                        AS user_telephone,

                    u.domaine
                        AS user_domaine

                FROM demandes_paiement d

                LEFT JOIN users u
                    ON u.id=d.user_id

                ORDER BY
                    d.created_at DESC
                `

            );


        return success(

            res,

            result.rows,

            "Demandes de paiement chargées"

        );

    } catch (err) {

        return error(

            res,

            "Impossible de charger les demandes de paiement.",

            500,

            err.message

        );

    }

}


/*
   Cette route reste disponible pour consultation,
   mais l'administration doit utiliser la route admin
   pour la gestion.
*/

app.get(

    "/api/demandes-paiement",

    getPaymentRequests

);


app.get(

    "/api/admin/demandes-paiement",

    adminAuth,

    getPaymentRequests

);


/* ============================================================
   42. DEMANDE DE PAIEMENT PAR ID
============================================================ */

async function getPaymentRequestById(req, res) {

    try {

        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            return error(

                res,

                "ID de demande invalide.",

                400

            );

        }


        const result =
            await pool.query(

                `
                SELECT

                    d.*,

                    u.nom
                        AS user_nom,

                    u.email
                        AS user_email,

                    u.telephone
                        AS user_telephone,

                    u.domaine
                        AS user_domaine,

                    u.premium
                        AS user_premium,

                    u.is_premium
                        AS user_is_premium,

                    u.premium_until
                        AS user_premium_until

                FROM demandes_paiement d

                LEFT JOIN users u
                    ON u.id=d.user_id

                WHERE d.id=$1

                LIMIT 1
                `,

                [id]

            );


        if (!result.rows.length) {

            return error(

                res,

                "Demande de paiement introuvable.",

                404

            );

        }


        return success(

            res,

            result.rows[0],

            "Demande de paiement trouvée"

        );

    } catch (err) {

        return error(

            res,

            "Impossible de charger la demande de paiement.",

            500,

            err.message

        );

    }

}


app.get(

    "/api/demandes-paiement/:id",

    getPaymentRequestById

);


app.get(

    "/api/admin/demandes-paiement/:id",

    adminAuth,

    getPaymentRequestById

);


/* ============================================================
   43. VALIDATION DEMANDE DE PAIEMENT
============================================================ */

/*
   Lorsqu'une demande est validée :

   1. La demande passe à "validated"
   2. L'utilisateur passe Premium
   3. premium_until est calculé
   4. Le tout se fait dans une transaction PostgreSQL

   IMPORTANT :

   Cette validation n'utilise PAS la table paiements.
   Elle travaille uniquement avec :

       demandes_paiement
       users
*/


async function validatePaymentRequest(req, res) {

    const client =
        await pool.connect();


    try {

        await client.query(
            "BEGIN"
        );


        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            await client.query(
                "ROLLBACK"
            );


            return error(

                res,

                "ID de demande invalide.",

                400

            );

        }


        /* ====================================================
           VERROUILLAGE DEMANDE
        ==================================================== */

        const demandeResult =
            await client.query(

                `
                SELECT *

                FROM demandes_paiement

                WHERE id=$1

                FOR UPDATE
                `,

                [id]

            );


        if (!demandeResult.rows.length) {

            await client.query(
                "ROLLBACK"
            );


            return error(

                res,

                "Demande de paiement introuvable.",

                404

            );

        }


        const demande =
            demandeResult.rows[0];


        const status =
            String(

                demande.status ||
                "pending"

            ).toLowerCase();


        if (
            status === "validated"
        ) {

            await client.query(
                "ROLLBACK"
            );


            return error(

                res,

                "Cette demande est déjà validée.",

                409

            );

        }


        if (
            status === "refused"
        ) {

            await client.query(
                "ROLLBACK"
            );


            return error(

                res,

                "Cette demande a déjà été refusée.",

                409

            );

        }


        const userId =
            parseId(
                demande.user_id
            );


        if (!userId) {

            await client.query(
                "ROLLBACK"
            );


            return error(

                res,

                "Cette demande n'est associée à aucun utilisateur.",

                400

            );

        }


        /* ====================================================
           VERROUILLAGE UTILISATEUR
        ==================================================== */

        const userResult =
            await client.query(

                `
                SELECT *

                FROM users

                WHERE id=$1

                FOR UPDATE
                `,

                [userId]

            );


        if (!userResult.rows.length) {

            await client.query(
                "ROLLBACK"
            );


            return error(

                res,

                "Utilisateur associé introuvable.",

                404

            );

        }


        const user =
            userResult.rows[0];


        if (

            user.blocked === true ||
            user.is_blocked === true

        ) {

            await client.query(
                "ROLLBACK"
            );


            return error(

                res,

                "Impossible d'activer Premium pour un utilisateur bloqué.",

                403

            );

        }


        /* ====================================================
           DURÉE PREMIUM
        ==================================================== */

        /*
           La durée par défaut reste de 30 jours,
           comme ton système Premium existant.
        */

        const days = 30;


        const now =
            new Date();


        let baseDate =
            now;


        if (
            user.premium_until
        ) {

            const currentUntil =
                new Date(
                    user.premium_until
                );


            if (
                currentUntil > now
            ) {

                baseDate =
                    currentUntil;

            }

        }


        const newPremiumUntil =
            new Date(
                baseDate
            );


        newPremiumUntil.setDate(

            newPremiumUntil.getDate() +
            days

        );


        /* ====================================================
           ACTIVATION PREMIUM
        ==================================================== */

        await client.query(

            `
            UPDATE users

            SET

                premium=true,

                is_premium=true,

                premium_until=$1,

                updated_at=
                    CURRENT_TIMESTAMP

            WHERE id=$2
            `,

            [

                newPremiumUntil,
                userId

            ]

        );


        /* ====================================================
           VALIDATION DEMANDE
        ==================================================== */

        const updated =
            await client.query(

                `
                UPDATE demandes_paiement

                SET

                    status='validated',

                    validated_at=
                        CURRENT_TIMESTAMP,

                    refused_at=NULL,

                    refusal_reason=NULL,

                    updated_at=
                        CURRENT_TIMESTAMP

                WHERE id=$1

                RETURNING *
                `,

                [id]

            );


        await client.query(
            "COMMIT"
        );


        await logActivity(

            "VALIDATE_PAYMENT_REQUEST",

            `Demande de paiement ${id} validée - Premium activé pour utilisateur ${userId}`,

            userId

        );


        return success(

            res,

            {

                demande:
                    updated.rows[0],

                user_id:
                    userId,

                premium:
                    true,

                is_premium:
                    true,

                premium_until:
                    newPremiumUntil,

                premium_days:
                    days

            },

            "Demande validée et Premium activé"

        );

    } catch (err) {

        try {

            await client.query(
                "ROLLBACK"
            );

        } catch (_) {}


        return error(

            res,

            "Impossible de valider la demande de paiement.",

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


/* ============================================================
   44. REFUS DEMANDE DE PAIEMENT
============================================================ */

async function refusePaymentRequest(req, res) {

    try {

        const id =
            parseId(
                req.params.id
            );


        if (!id) {

            return error(

                res,

                "ID de demande invalide.",

                400

            );

        }


        const body =
            req.body || {};


        const reason =
            String(

                body.reason ||
                body.motif ||
                body.refusal_reason ||
                "Demande de paiement refusée par l'administrateur"

            ).trim();


        const result =
            await pool.query(

                `
                UPDATE demandes_paiement

                SET

                    status='refused',

                    refusal_reason=$1,

                    refused_at=
                        CURRENT_TIMESTAMP,

                    updated_at=
                        CURRENT_TIMESTAMP

                WHERE id=$2

                AND LOWER(
                    COALESCE(status,'pending')
                ) <> 'validated'

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
                    SELECT

                        id,
                        status

                    FROM demandes_paiement

                    WHERE id=$1
                    `,

                    [id]

                );


            if (!check.rows.length) {

                return error(

                    res,

                    "Demande de paiement introuvable.",

                    404

                );

            }


            return error(

                res,

                "Une demande déjà validée ne peut pas être refusée.",

                409

            );

        }


        const demande =
            result.rows[0];


        await logActivity(

            "REFUSE_PAYMENT_REQUEST",

            `Demande ${id} refusée : ${reason}`,

            demande.user_id

        );


        return success(

            res,

            demande,

            "Demande de paiement refusée"

        );

    } catch (err) {

        return error(

            res,

            "Impossible de refuser la demande de paiement.",

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
   45. GESTION PREMIUM MANUELLE PAR ADMIN
============================================================ */

app.patch(
    "/api/admin/users/:id/premium",
    adminAuth,
    async function (req, res) {

        try {

            /* ====================================================
               ID UTILISATEUR
            ==================================================== */

            const id = parseId(
                req.params.id
            );

            if (!id) {

                return error(
                    res,
                    "ID utilisateur invalide.",
                    400
                );

            }


            /* ====================================================
               LECTURE DE LA DEMANDE
            ==================================================== */

            const body = req.body || {};


            /*
               Le frontend doit envoyer :

               {
                   enabled: true
               }

               ou

               {
                   enabled: false
               }

               On accepte aussi quelques anciennes formes
               pour éviter les problèmes de compatibilité.
            */

            let enabled;


            if (body.enabled !== undefined) {

                if (
                    body.enabled === true ||
                    body.enabled === 1 ||
                    body.enabled === "1" ||
                    String(body.enabled).toLowerCase() === "true"
                ) {

                    enabled = true;

                } else {

                    enabled = false;

                }

            }

            else if (body.premium !== undefined) {

                if (
                    body.premium === true ||
                    body.premium === 1 ||
                    body.premium === "1" ||
                    String(body.premium).toLowerCase() === "true"
                ) {

                    enabled = true;

                } else {

                    enabled = false;

                }

            }

            else if (body.is_premium !== undefined) {

                if (
                    body.is_premium === true ||
                    body.is_premium === 1 ||
                    body.is_premium === "1" ||
                    String(body.is_premium).toLowerCase() === "true"
                ) {

                    enabled = true;

                } else {

                    enabled = false;

                }

            }

            else {

                /*
                   Si aucun état n'est envoyé,
                   on considère l'action comme une activation.
                */

                enabled = true;

            }


            /* ====================================================
               DURÉE PREMIUM
            ==================================================== */

            let days = Number(
                body.days ??
                body.premium_days ??
                30
            );


            if (
                enabled &&
                (
                    !Number.isInteger(days) ||
                    days <= 0 ||
                    days > 3650
                )
            ) {

                return error(
                    res,
                    "Nombre de jours Premium invalide.",
                    400
                );

            }


            /* ====================================================
               VÉRIFICATION UTILISATEUR
            ==================================================== */

            const userResult =
                await pool.query(

                    `
                    SELECT
                        id,
                        nom,
                        email,
                        premium,
                        is_premium,
                        premium_until,
                        blocked,
                        is_blocked
                    FROM users
                    WHERE id=$1
                    LIMIT 1
                    `,

                    [id]

                );


            if (!userResult.rows.length) {

                return error(
                    res,
                    "Utilisateur introuvable.",
                    404
                );

            }


            const user =
                userResult.rows[0];


            /* ====================================================
               RETRAIT PREMIUM
            ==================================================== */

            if (!enabled) {

                const result =
                    await pool.query(

                        `
                        UPDATE users

                        SET
                            premium=false,
                            is_premium=false,
                            premium_until=NULL,
                            updated_at=CURRENT_TIMESTAMP

                        WHERE id=$1

                        RETURNING
                            id,
                            nom,
                            email,
                            premium,
                            is_premium,
                            premium_until
                        `,

                        [id]

                    );


                if (!result.rows.length) {

                    return error(
                        res,
                        "Utilisateur introuvable.",
                        404
                    );

                }


                await logActivity(

                    "DISABLE_PREMIUM",

                    `Premium désactivé pour l'utilisateur ${id}`,

                    id

                );


                return success(

                    res,

                    {
                        ...result.rows[0],
                        premium_days: 0
                    },

                    "Le statut Premium a été retiré."

                );

            }


            /* ====================================================
               ACTIVATION PREMIUM
            ==================================================== */

            const now =
                new Date();

            let baseDate =
                now;


            if (user.premium_until) {

                const currentUntil =
                    new Date(
                        user.premium_until
                    );


                if (
                    !isNaN(currentUntil.getTime()) &&
                    currentUntil > now
                ) {

                    baseDate =
                        currentUntil;

                }

            }


            const premiumUntil =
                new Date(baseDate);


            premiumUntil.setDate(
                premiumUntil.getDate() + days
            );


            /* ====================================================
               ACTIVATION
            ==================================================== */

            const result =
                await pool.query(

                    `
                    UPDATE users

                    SET
                        premium=true,
                        is_premium=true,
                        premium_until=$1,
                        updated_at=CURRENT_TIMESTAMP

                    WHERE id=$2

                    RETURNING
                        id,
                        nom,
                        email,
                        premium,
                        is_premium,
                        premium_until
                    `,

                    [
                        premiumUntil,
                        id
                    ]

                );


            if (!result.rows.length) {

                return error(
                    res,
                    "Utilisateur introuvable.",
                    404
                );

            }


            /* ====================================================
               JOURNAL ADMIN
            ==================================================== */

            await logActivity(

                "ENABLE_PREMIUM",

                `Premium activé pour l'utilisateur ${id} pendant ${days} jours`,

                id

            );


            /* ====================================================
               RÉPONSE
            ==================================================== */

            return success(

                res,

                {
                    ...result.rows[0],
                    premium_days: days
                },

                "Le statut Premium a été activé."

            );

        }

        catch (err) {

            console.error(
                "Erreur gestion Premium :",
                err
            );


            return error(

                res,

                "Impossible de modifier le statut Premium.",

                500,

                err.message

            );

        }

    }
);

/* ============================================================
   46. STATISTIQUES
============================================================ */

async function statistics(req, res) {

    try {

        const result =
            await pool.query(

                `
                SELECT

                    (
                        SELECT COUNT(*)
                        FROM users
                    )::int AS utilisateurs,

                    (
                        SELECT COUNT(*)
                        FROM users
                        WHERE premium=true
                           OR is_premium=true
                    )::int AS premium,

                    (
                        SELECT COUNT(*)
                        FROM users
                        WHERE blocked=true
                           OR is_blocked=true
                    )::int AS bloques,

                    (
                        SELECT COUNT(*)
                        FROM paiements
                    )::int AS paiements,

                    (
                        SELECT COUNT(*)
                        FROM paiements
                        WHERE LOWER(status)
                        IN (
                            'pending',
                            'en_attente',
                            'attente'
                        )
                    )::int AS en_attente,

                    (
                        SELECT COUNT(*)
                        FROM paiements
                        WHERE LOWER(status)
                        = 'validated'
                    )::int AS valides,

                    (
                        SELECT COUNT(*)
                        FROM paiements
                        WHERE LOWER(status)
                        = 'refused'
                    )::int AS refuses,

                    (
                        SELECT COUNT(*)
                        FROM demandes_paiement
                    )::int AS demandes_paiement,

                    (
                        SELECT COUNT(*)
                        FROM demandes_paiement
                        WHERE LOWER(
                            COALESCE(status,'pending')
                        )='pending'
                    )::int AS demandes_en_attente,

                    (
                        SELECT COUNT(*)
                        FROM demandes_paiement
                        WHERE LOWER(
                            COALESCE(status,'pending')
                        )='validated'
                    )::int AS demandes_validees,

                    (
                        SELECT COUNT(*)
                        FROM demandes_paiement
                        WHERE LOWER(
                            COALESCE(status,'pending')
                        )='refused'
                    )::int AS demandes_refusees,

                    (
                        SELECT COALESCE(
                            SUM(amount),
                            0
                        )
                        FROM paiements
                        WHERE LOWER(status)
                        = 'validated'
                    ) AS revenus

                `

            );


        const s =
            result.rows[0];


        return success(

            res,

            {

                utilisateurs:
                    Number(
                        s.utilisateurs
                    ),

                premium:
                    Number(
                        s.premium
                    ),

                bloques:
                    Number(
                        s.bloques
                    ),

                paiements:
                    Number(
                        s.paiements
                    ),

                en_attente:
                    Number(
                        s.en_attente
                    ),

                valides:
                    Number(
                        s.valides
                    ),

                refuses:
                    Number(
                        s.refuses
                    ),

                demandes_paiement:
                    Number(
                        s.demandes_paiement
                    ),

                demandes_en_attente:
                    Number(
                        s.demandes_en_attente
                    ),

                demandes_validees:
                    Number(
                        s.demandes_validees
                    ),

                demandes_refusees:
                    Number(
                        s.demandes_refusees
                    ),

                revenus:
                    s.revenus

            },

            "Statistiques chargées"

        );

    } catch (err) {

        return error(

            res,

            "Impossible de charger les statistiques.",

            500,

            err.message

        );

    }

}


app.get(

    "/api/admin/statistiques",

    adminAuth,

    statistics

);


app.get(

    "/api/statistiques",

    statistics

);


/* ============================================================
   47. ROUTE 404
============================================================ */

app.use(

    function(req, res) {

        return res.status(404).json({

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


/* ============================================================
   48. GESTIONNAIRE D'ERREURS
============================================================ */

app.use(

    function(err, req, res, next) {

        console.error(
            "Erreur serveur :",
            err
        );


        if (res.headersSent) {

            return next(err);

        }


        return res.status(500).json({

            success: false,

            message:
                "Erreur interne du serveur.",

            error:
                err.message

        });

    }

);


/* ============================================================
   49. ARRÊT PROPRE
============================================================ */

async function gracefulShutdown(signal) {

    console.log(

        `${signal} reçu. Arrêt du serveur...`

    );


    try {

        await pool.end();


        console.log(

            "Connexion PostgreSQL fermée."

        );


        process.exit(0);

    } catch (err) {

        console.error(

            "Erreur arrêt serveur :",

            err

        );


        process.exit(1);

    }

}


process.on(

    "SIGTERM",

    function() {

        gracefulShutdown(
            "SIGTERM"
        );

    }

);


process.on(

    "SIGINT",

    function() {

        gracefulShutdown(
            "SIGINT"
        );

    }

);


/* ============================================================
   50. DÉMARRAGE SERVEUR
============================================================ */

async function startServer() {

    try {

        await initDatabase();


        app.listen(

            PORT,

            "0.0.0.0",

            function() {

                console.log("");

                console.log(
                    "=================================================="
                );

                console.log(
                    "          BMJ SERVICE BACKEND"
                );

                console.log(
                    "          VERSION : 13.0.0"
                );

                console.log(
                    `          PORT : ${PORT}`
                );

                console.log(
                    "          DATABASE : PostgreSQL"
                );

                console.log(
                    "          SERVER : Render"
                );

                console.log(
                    "          STATUS : ONLINE"
                );

                console.log(
                    "=================================================="
                );

                console.log(
                    `ADMIN EMAIL : ${ADMIN_EMAIL}`
                );

                console.log(
                    "=================================================="
                );

                console.log(
                    `TOTAL ROUTES : ${ROUTES.length}`
                );

                console.log(
                    "=================================================="
                );

                console.log(
                    "NOUVELLE FONCTIONNALITÉ :"
                );

                console.log(
                    "POST /api/demandes-paiement"
                );

                console.log(
                    "TABLE : demandes_paiement"
                );

                console.log(
                    "=================================================="
                );

            }

        );

    } catch (err) {

        console.error("");

        console.error(
            "=================================================="
        );

        console.error(
            "IMPOSSIBLE DE DÉMARRER BMJ SERVICE"
        );

        console.error(
            "=================================================="
        );

        console.error(err);

        process.exit(1);

    }

}


startServer();