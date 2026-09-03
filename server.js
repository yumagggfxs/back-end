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
   BMJ SERVICE
   ============================================================
   24. MESSAGERIE COMPLÈTE
   ------------------------------------------------------------
   VERSION PROPRE + COMPATIBILITÉ
   ------------------------------------------------------------
   FONCTIONS :

   ADMIN
   GET    /api/messages
   GET    /api/messages/reponses
   GET    /api/messages/:id
   GET    /api/admin/messages/user/:userId

   POST   /api/messages/send-user
   POST   /api/messages/user

   POST   /api/messages/send-all
   POST   /api/messages/send-standard
   POST   /api/messages/send-premium
   POST   /api/messages/send-official
   POST   /api/messages/official

   PATCH  /api/messages/:id
   POST   /api/messages/:id/convert
   DELETE /api/messages/:id


   UTILISATEUR
   GET    /api/utilisateurs/:id/messages
   GET    /api/utilisateurs/:userId/messages/:messageId

   PATCH  /api/utilisateurs/:userId/messages/:messageId/read

   POST   /api/utilisateurs/:userId/messages/:messageId/repondre
   POST   /api/utilisateurs/:userId/messages/:messageId/reply

   POST   /api/messages/reply

   GET    /api/utilisateurs/:userId/messages/stream

   ============================================================ */


/* ============================================================
   24.1 CONFIGURATION
============================================================ */

const MESSAGE_TYPES = {
    USER: "user",
    OFFICIAL: "official",
    USER_REPLY: "user_reply"
};


const MESSAGE_PRIORITIES = {
    NORMAL: "normal",
    IMPORTANT: "important",
    URGENT: "urgent"
};


const MESSAGE_AUDIENCES = {
    ALL: "all",
    STANDARD: "standard",
    PREMIUM: "premium",
    INDIVIDUAL: "individual",
    ADMIN: "admin"
};


/*
 * Connexions SSE actives.
 *
 * userId => Set(response)
 *
 * Exemple :
 *
 * 12 => Set(res1, res2)
 * 18 => Set(res3)
 */

const messageSSEClients = new Map();


/* ============================================================
   24.2 NORMALISATION
============================================================ */

function normalizeMessagePriority(value) {

    const priority =
        String(value || "normal")
            .trim()
            .toLowerCase();

    if (
        priority === "urgent" ||
        priority === "important"
    ) {
        return priority;
    }

    return "normal";
}


function normalizeMessageAudience(value) {

    const audience =
        String(value || "individual")
            .trim()
            .toLowerCase();

    if (
        [
            "all",
            "standard",
            "premium",
            "individual",
            "admin"
        ].includes(audience)
    ) {
        return audience;
    }

    return "individual";
}


function normalizeMessageType(value) {

    const type =
        String(value || "user")
            .trim()
            .toLowerCase();

    if (
        type === "official" ||
        type === "user_reply" ||
        type === "user"
    ) {
        return type;
    }

    return "user";
}


/* ============================================================
   24.3 UTILITAIRES
============================================================ */

function messageUserIsPremium(user) {

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

        const until =
            new Date(user.premium_until);

        if (
            !isNaN(until.getTime()) &&
            until > new Date()
        ) {
            return true;
        }
    }

    return false;
}


function getMessageId(value) {

    const id = Number(value);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        return null;
    }

    return id;
}


function cleanMessageText(value, maxLength = 10000) {

    return String(value ?? "")
        .trim()
        .substring(0, maxLength);
}


function getAdminEmail() {

    return (
        typeof ADMIN_EMAIL !== "undefined"
            ? ADMIN_EMAIL
            : (
                process.env.ADMIN_EMAIL ||
                "admin@bmjservice.com"
            )
    );
}


/* ============================================================
   24.4 RÉCUPÉRER UN UTILISATEUR
============================================================ */

async function getMessageUserById(userId) {

    const id =
        getMessageId(userId);

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

    return result.rows[0] || null;
}


/* ============================================================
   24.5 CRÉATION / VÉRIFICATION TABLE MESSAGES
============================================================ */

async function initializeMessageDatabase() {

    try {

        /*
         * Création de la table principale.
         */

        await pool.query(
            `
            CREATE TABLE IF NOT EXISTS messages (

                id SERIAL PRIMARY KEY,

                sender_type VARCHAR(30)
                    NOT NULL
                    DEFAULT 'admin',

                sender_user_id INTEGER,

                sender_name TEXT,
                sender_email TEXT,

                recipient_user_id INTEGER,

                recipient_name TEXT,
                recipient_email TEXT,

                subject TEXT
                    NOT NULL
                    DEFAULT 'Message BMJ SERVICE',

                content TEXT
                    NOT NULL,

                type VARCHAR(30)
                    NOT NULL
                    DEFAULT 'user',

                priority VARCHAR(20)
                    NOT NULL
                    DEFAULT 'normal',

                audience VARCHAR(30)
                    NOT NULL
                    DEFAULT 'individual',

                status VARCHAR(30)
                    NOT NULL
                    DEFAULT 'unread',

                read_at TIMESTAMPTZ,

                created_at TIMESTAMPTZ
                    NOT NULL
                    DEFAULT NOW(),

                updated_at TIMESTAMPTZ
                    NOT NULL
                    DEFAULT NOW()
            )
            `
        );


        /*
         * Compatibilité avec une table déjà existante.
         */

        const columns = [

            [
                "sender_type",
                "VARCHAR(30) DEFAULT 'admin'"
            ],

            [
                "sender_user_id",
                "INTEGER"
            ],

            [
                "sender_name",
                "TEXT"
            ],

            [
                "sender_email",
                "TEXT"
            ],

            [
                "recipient_user_id",
                "INTEGER"
            ],

            [
                "recipient_name",
                "TEXT"
            ],

            [
                "recipient_email",
                "TEXT"
            ],

            [
                "subject",
                "TEXT DEFAULT 'Message BMJ SERVICE'"
            ],

            [
                "content",
                "TEXT"
            ],

            [
                "type",
                "VARCHAR(30) DEFAULT 'user'"
            ],

            [
                "priority",
                "VARCHAR(20) DEFAULT 'normal'"
            ],

            [
                "audience",
                "VARCHAR(30) DEFAULT 'individual'"
            ],

            [
                "status",
                "VARCHAR(30) DEFAULT 'unread'"
            ],

            [
                "read_at",
                "TIMESTAMPTZ"
            ],

            [
                "created_at",
                "TIMESTAMPTZ DEFAULT NOW()"
            ],

            [
                "updated_at",
                "TIMESTAMPTZ DEFAULT NOW()"
            ]
        ];


        for (const [name, definition] of columns) {

            try {

                await pool.query(
                    `
                    ALTER TABLE messages
                    ADD COLUMN IF NOT EXISTS ${name}
                    ${definition}
                    `
                );

            } catch (error) {

                console.warn(
                    `Colonne messages.${name} :`,
                    error.message
                );
            }
        }


        /*
         * Index.
         */

        await pool.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_messages_recipient_user
            ON messages(recipient_user_id)
            `
        );


        await pool.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_messages_created
            ON messages(created_at DESC)
            `
        );


        await pool.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_messages_type
            ON messages(type)
            `
        );


        await pool.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_messages_audience
            ON messages(audience)
            `
        );


        await pool.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_messages_status
            ON messages(status)
            `
        );


        console.log(
            "✓ Table messages vérifiée."
        );


    } catch (error) {

        console.error(
            "❌ Initialisation messages :",
            error
        );
    }
}


/* ============================================================
   24.6 NOTIFICATION TEMPS RÉEL
============================================================ */

function notifyMessageUser(
    userId,
    message = null
) {

    const id =
        getMessageId(userId);

    if (!id) {
        return;
    }


    const clients =
        messageSSEClients.get(id);

    if (
        !clients ||
        clients.size === 0
    ) {
        return;
    }


    const payload =
        JSON.stringify({
            success: true,
            type: "new_message",
            message: message || null,
            timestamp:
                new Date().toISOString()
        });


    for (const client of clients) {

        try {

            client.write(
                `event: message\n`
            );

            client.write(
                `data: ${payload}\n\n`
            );

        } catch (error) {

            try {
                clients.delete(client);
            } catch {}
        }
    }


    if (clients.size === 0) {

        messageSSEClients.delete(id);
    }
}


/* ============================================================
   24.7 NOTIFIER PLUSIEURS UTILISATEURS
============================================================ */

function notifyMessageUsers(
    users,
    message
) {

    if (!Array.isArray(users)) {
        return;
    }

    for (const user of users) {

        if (user?.id) {

            notifyMessageUser(
                user.id,
                message
            );
        }
    }
}


/* ============================================================
   24.8 CONSTRUIRE UN MESSAGE
============================================================ */

function formatMessageForUser(message) {

    if (!message) {
        return null;
    }

    return {

        id: message.id,

        sender_type:
            message.sender_type,

        sender_user_id:
            message.sender_user_id,

        sender_name:
            message.sender_name,

        sender_email:
            message.sender_email,

        recipient_user_id:
            message.recipient_user_id,

        recipient_name:
            message.recipient_name,

        recipient_email:
            message.recipient_email,

        subject:
            message.subject,

        content:
            message.content,

        type:
            message.type,

        priority:
            message.priority,

        audience:
            message.audience,

        status:
            message.status || "unread",

        read_at:
            message.read_at,

        created_at:
            message.created_at,

        updated_at:
            message.updated_at
    };
}


/* ============================================================
   24.9 RÉCUPÉRER MESSAGE PAR ID
============================================================ */

async function getCompleteMessageById(
    messageId
) {

    const id =
        getMessageId(messageId);

    if (!id) {
        return null;
    }


    const result =
        await pool.query(
            `
            SELECT
                m.*,

                u.nom AS user_nom,
                u.email AS user_email,
                u.telephone AS user_telephone,
                u.premium AS user_premium,
                u.is_premium AS user_is_premium

            FROM messages m

            LEFT JOIN users u
                ON u.id = m.recipient_user_id

            WHERE m.id = $1

            LIMIT 1
            `,
            [id]
        );


    return result.rows[0] || null;
}


/* ============================================================
   24.10 ROUTE :
   GET /api/messages
   ADMIN
============================================================ */

app.get(
    "/api/messages",
    adminAuth,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        m.*,

                        u.nom AS user_nom,
                        u.email AS user_email,
                        u.telephone AS user_telephone,
                        u.premium AS user_premium,
                        u.is_premium AS user_is_premium,
                        u.premium_until AS user_premium_until

                    FROM messages m

                    LEFT JOIN users u
                        ON u.id = m.recipient_user_id

                    ORDER BY
                        m.created_at DESC,
                        m.id DESC
                    `
                );


            return res.json({

                success: true,

                messages:
                    result.rows,

                count:
                    result.rows.length
            });


        } catch (error) {

            console.error(
                "GET /api/messages :",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Impossible de récupérer les messages."
            });
        }
    }
);


/* ============================================================
   24.11 ROUTE :
   GET /api/messages/reponses
   IMPORTANT :
   CETTE ROUTE DOIT ÊTRE AVANT /:id
============================================================ */

app.get(
    "/api/messages/reponses",
    adminAuth,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        m.*,

                        u.nom AS user_nom,
                        u.email AS user_email,
                        u.telephone AS user_telephone

                    FROM messages m

                    LEFT JOIN users u
                        ON u.id = m.sender_user_id

                    WHERE
                        LOWER(
                            COALESCE(
                                m.sender_type,
                                ''
                            )
                        ) = 'user'

                    ORDER BY
                        m.created_at DESC,
                        m.id DESC
                    `
                );


            return res.json({

                success: true,

                messages:
                    result.rows,

                count:
                    result.rows.length
            });


        } catch (error) {

            console.error(
                "GET /api/messages/reponses :",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Impossible de récupérer les réponses."
            });
        }
    }
);


/* ============================================================
   24.12 ROUTE :
   GET /api/messages/:id
   ADMIN
============================================================ */

app.get(
    "/api/messages/:id",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                getMessageId(
                    req.params.id
                );


            if (!id) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant message invalide."
                });
            }


            const message =
                await getCompleteMessageById(id);


            if (!message) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Message introuvable."
                });
            }


            return res.json({

                success: true,

                message
            });


        } catch (error) {

            console.error(
                "GET /api/messages/:id :",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Impossible de récupérer le message."
            });
        }
    }
);


/* ============================================================
   24.13 ENVOYER MESSAGE PERSONNEL
   POST /api/messages/send-user
============================================================ */

async function sendIndividualMessage(
    req,
    res
) {

    try {

        const userId =
            getMessageId(
                req.body?.user_id ||
                req.body?.userId
            );


        const subject =
            cleanMessageText(
                req.body?.subject ||
                "Message BMJ SERVICE",
                500
            );


        const content =
            cleanMessageText(
                req.body?.content,
                10000
            );


        const priority =
            normalizeMessagePriority(
                req.body?.priority
            );


        if (!userId) {

            return res.status(400).json({

                success: false,

                message:
                    "Utilisateur invalide."
            });
        }


        if (!content) {

            return res.status(400).json({

                success: false,

                message:
                    "Le message ne peut pas être vide."
            });
        }


        const user =
            await getMessageUserById(
                userId
            );


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "Utilisateur introuvable."
            });
        }


        const result =
            await pool.query(
                `
                INSERT INTO messages (

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

                    status,

                    created_at,
                    updated_at

                )

                VALUES (

                    'admin',
                    $1,
                    $2,

                    $3,
                    $4,
                    $5,

                    $6,
                    $7,

                    'user',
                    $8,
                    'individual',

                    'unread',

                    NOW(),
                    NOW()
                )

                RETURNING *
                `,
                [

                    "BMJ SERVICE",

                    getAdminEmail(),

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
            formatMessageForUser(
                result.rows[0]
            );


        /*
         * NOTIFICATION IMMÉDIATE
         */

        notifyMessageUser(
            user.id,
            message
        );


        /*
         * Journal admin si disponible.
         */

        try {

            if (
                typeof logActivity ===
                "function"
            ) {

                await logActivity(
                    req,
                    "message_send_user",
                    {
                        user_id: user.id,
                        message_id: message.id
                    }
                );
            }

        } catch (activityError) {

            console.warn(
                "Log activité messagerie :",
                activityError.message
            );
        }


        return res.status(201).json({

            success: true,

            message:
                "Message envoyé avec succès.",

            data:
                message
        });


    } catch (error) {

        console.error(
            "POST /api/messages/send-user :",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Impossible d'envoyer le message."
        });
    }
}


app.post(
    "/api/messages/send-user",
    adminAuth,
    sendIndividualMessage
);


/*
 * Ancienne route compatible.
 */

app.post(
    "/api/messages/user",
    adminAuth,
    sendIndividualMessage
);


/* ============================================================
   24.14 ENVOI OFFICIEL
============================================================ */

async function sendOfficialMessage(
    req,
    res,
    forcedAudience = null
) {

    try {

        const audience =
            normalizeMessageAudience(
                forcedAudience ||
                req.body?.audience ||
                "all"
            );


        const subject =
            cleanMessageText(
                req.body?.subject ||
                "Annonce BMJ SERVICE",
                500
            );


        const content =
            cleanMessageText(
                req.body?.content,
                10000
            );


        const priority =
            normalizeMessagePriority(
                req.body?.priority
            );


        if (!content) {

            return res.status(400).json({

                success: false,

                message:
                    "Le message ne peut pas être vide."
            });
        }


        /*
         * Une annonce officielle est UNE entrée
         * en base, pas une copie par utilisateur.
         */

        const result =
            await pool.query(
                `
                INSERT INTO messages (

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

                    status,

                    created_at,
                    updated_at

                )

                VALUES (

                    'admin',
                    $1,
                    $2,

                    NULL,
                    NULL,
                    NULL,

                    $3,
                    $4,

                    'official',
                    $5,
                    $6,

                    'unread',

                    NOW(),
                    NOW()
                )

                RETURNING *
                `,
                [

                    "BMJ SERVICE",

                    getAdminEmail(),

                    subject,

                    content,

                    priority,

                    audience
                ]
            );


        const message =
            formatMessageForUser(
                result.rows[0]
            );


        /*
         * Déterminer les utilisateurs
         * actuellement concernés.
         */

        let usersQuery = `
            SELECT
                id,
                nom,
                email,
                premium,
                is_premium,
                premium_until
            FROM users
            WHERE 1 = 1
        `;

        const params = [];


        if (
            audience === "standard"
        ) {

            usersQuery += `
                AND COALESCE(premium, false) = false
                AND COALESCE(is_premium, false) = false
                AND (
                    premium_until IS NULL
                    OR premium_until <= NOW()
                )
            `;
        }


        if (
            audience === "premium"
        ) {

            usersQuery += `
                AND (
                    COALESCE(premium, false) = true
                    OR COALESCE(is_premium, false) = true
                    OR premium_until > NOW()
                )
            `;
        }


        const usersResult =
            await pool.query(
                usersQuery,
                params
            );


        /*
         * Notification temps réel.
         */

        notifyMessageUsers(
            usersResult.rows,
            message
        );


        return res.status(201).json({

            success: true,

            message:
                "Annonce envoyée avec succès.",

            data:
                message,

            recipients:
                usersResult.rows.length
        });


    } catch (error) {

        console.error(
            "Envoi annonce officielle :",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Impossible d'envoyer l'annonce."
        });
    }
}


/* ============================================================
   24.15 ROUTES ANNONCES
============================================================ */

app.post(
    "/api/messages/send-official",
    adminAuth,
    async (req, res) => {

        return sendOfficialMessage(
            req,
            res
        );
    }
);


app.post(
    "/api/messages/official",
    adminAuth,
    async (req, res) => {

        return sendOfficialMessage(
            req,
            res
        );
    }
);


app.post(
    "/api/messages/send-all",
    adminAuth,
    async (req, res) => {

        return sendOfficialMessage(
            req,
            res,
            "all"
        );
    }
);


app.post(
    "/api/messages/send-standard",
    adminAuth,
    async (req, res) => {

        return sendOfficialMessage(
            req,
            res,
            "standard"
        );
    }
);


app.post(
    "/api/messages/send-premium",
    adminAuth,
    async (req, res) => {

        return sendOfficialMessage(
            req,
            res,
            "premium"
        );
    }
);


/* ============================================================
   24.16 MODIFIER MESSAGE
   PATCH /api/messages/:id
============================================================ */

app.patch(
    "/api/messages/:id",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                getMessageId(
                    req.params.id
                );


            if (!id) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant invalide."
                });
            }


            const existing =
                await getCompleteMessageById(id);


            if (!existing) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Message introuvable."
                });
            }


            const subject =
                req.body?.subject !== undefined
                    ? cleanMessageText(
                        req.body.subject,
                        500
                    )
                    : existing.subject;


            const content =
                req.body?.content !== undefined
                    ? cleanMessageText(
                        req.body.content,
                        10000
                    )
                    : existing.content;


            const priority =
                req.body?.priority !== undefined
                    ? normalizeMessagePriority(
                        req.body.priority
                    )
                    : existing.priority;


            const result =
                await pool.query(
                    `
                    UPDATE messages

                    SET
                        subject = $1,
                        content = $2,
                        priority = $3,
                        updated_at = NOW()

                    WHERE id = $4

                    RETURNING *
                    `,
                    [
                        subject,
                        content,
                        priority,
                        id
                    ]
                );


            const message =
                formatMessageForUser(
                    result.rows[0]
                );


            /*
             * Si un message est modifié,
             * on prévient l'utilisateur concerné.
             */

            if (
                message.recipient_user_id
            ) {

                notifyMessageUser(
                    message.recipient_user_id,
                    message
                );
            }


            return res.json({

                success: true,

                message:
                    "Message modifié avec succès.",

                data:
                    message
            });


        } catch (error) {

            console.error(
                "PATCH message :",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Impossible de modifier le message."
            });
        }
    }
);


/* ============================================================
   24.17 CONVERSION MESSAGE
============================================================ */

app.post(
    "/api/messages/:id/convert",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                getMessageId(
                    req.params.id
                );


            if (!id) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant invalide."
                });
            }


            const existing =
                await getCompleteMessageById(id);


            if (!existing) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Message introuvable."
                });
            }


            const mode =
                String(
                    req.body?.mode || ""
                )
                    .trim()
                    .toLowerCase();


            /*
             * Conversion en message individuel.
             */

            if (
                mode === "user"
            ) {

                const userId =
                    getMessageId(
                        req.body?.user_id ||
                        req.body?.userId
                    );


                if (!userId) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "Utilisateur invalide."
                    });
                }


                const user =
                    await getMessageUserById(
                        userId
                    );


                if (!user) {

                    return res.status(404).json({

                        success: false,

                        message:
                            "Utilisateur introuvable."
                    });
                }


                const result =
                    await pool.query(
                        `
                        UPDATE messages

                        SET
                            type = 'user',
                            audience = 'individual',

                            recipient_user_id = $1,
                            recipient_name = $2,
                            recipient_email = $3,

                            updated_at = NOW()

                        WHERE id = $4

                        RETURNING *
                        `,
                        [
                            user.id,
                            user.nom,
                            user.email,
                            id
                        ]
                    );


                const message =
                    formatMessageForUser(
                        result.rows[0]
                    );


                notifyMessageUser(
                    user.id,
                    message
                );


                return res.json({

                    success: true,

                    message:
                        "Message converti en message personnel.",

                    data:
                        message
                });
            }


            /*
             * Conversion en annonce.
             */

            if (
                mode === "official"
            ) {

                const audience =
                    normalizeMessageAudience(
                        req.body?.audience ||
                        "all"
                    );


                const result =
                    await pool.query(
                        `
                        UPDATE messages

                        SET
                            type = 'official',
                            audience = $1,

                            recipient_user_id = NULL,
                            recipient_name = NULL,
                            recipient_email = NULL,

                            updated_at = NOW()

                        WHERE id = $2

                        RETURNING *
                        `,
                        [
                            audience,
                            id
                        ]
                    );


                const message =
                    formatMessageForUser(
                        result.rows[0]
                    );


                return res.json({

                    success: true,

                    message:
                        "Message converti en annonce.",

                    data:
                        message
                });
            }


            return res.status(400).json({

                success: false,

                message:
                    "Mode de conversion invalide."
            });


        } catch (error) {

            console.error(
                "Conversion message :",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Impossible de convertir le message."
            });
        }
    }
);


/* ============================================================
   24.18 SUPPRIMER MESSAGE
============================================================ */

app.delete(
    "/api/messages/:id",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                getMessageId(
                    req.params.id
                );


            if (!id) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant invalide."
                });
            }


            const existing =
                await getCompleteMessageById(id);


            if (!existing) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Message introuvable."
                });
            }


            await pool.query(
                `
                DELETE FROM messages
                WHERE id = $1
                `,
                [id]
            );


            return res.json({

                success: true,

                message:
                    "Message supprimé avec succès."
            });


        } catch (error) {

            console.error(
                "DELETE message :",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Impossible de supprimer le message."
            });
        }
    }
);


/* ============================================================
   24.19 MESSAGES UTILISATEUR
============================================================ */

app.get(
    "/api/utilisateurs/:id/messages",
    async (req, res) => {

        try {

            const userId =
                getMessageId(
                    req.params.id
                );


            if (!userId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant utilisateur invalide."
                });
            }


            const user =
                await getMessageUserById(
                    userId
                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable."
                });
            }


            const premium =
                messageUserIsPremium(user);


            /*
             * IMPORTANT :
             *
             * On ne filtre PAS les annonces dans PostgreSQL
             * avec le statut read.
             *
             * Le message existe une seule fois.
             *
             * On retourne les annonces correspondant
             * au statut actuel de l'utilisateur.
             */

            const result =
                await pool.query(
                    `
                    SELECT

                        m.id,

                        m.sender_type,
                        m.sender_user_id,
                        m.sender_name,
                        m.sender_email,

                        m.recipient_user_id,
                        m.recipient_name,
                        m.recipient_email,

                        m.subject,
                        m.content,

                        m.type,
                        m.priority,
                        m.audience,

                        m.status,
                        m.read_at,

                        m.created_at,
                        m.updated_at

                    FROM messages m

                    WHERE

                        /*
                         * MESSAGE PERSONNEL
                         */
                        m.recipient_user_id = $1

                        OR

                        /*
                         * ANNONCE POUR TOUT LE MONDE
                         */
                        (
                            LOWER(
                                COALESCE(
                                    m.type,
                                    ''
                                )
                            ) = 'official'

                            AND

                            LOWER(
                                COALESCE(
                                    m.audience,
                                    ''
                                )
                            ) = 'all'
                        )

                        OR

                        /*
                         * ANNONCE STANDARD
                         */
                        (
                            LOWER(
                                COALESCE(
                                    m.type,
                                    ''
                                )
                            ) = 'official'

                            AND

                            LOWER(
                                COALESCE(
                                    m.audience,
                                    ''
                                )
                            ) = 'standard'

                            AND

                            $2 = FALSE
                        )

                        OR

                        /*
                         * ANNONCE PREMIUM
                         */
                        (
                            LOWER(
                                COALESCE(
                                    m.type,
                                    ''
                                )
                            ) = 'official'

                            AND

                            LOWER(
                                COALESCE(
                                    m.audience,
                                    ''
                                )
                            ) = 'premium'

                            AND

                            $2 = TRUE
                        )

                    ORDER BY
                        m.created_at DESC,
                        m.id DESC
                    `,
                    [
                        userId,
                        premium
                    ]
                );


            return res.json({

                success: true,

                messages:
                    result.rows.map(
                        formatMessageForUser
                    ),

                count:
                    result.rows.length
            });


        } catch (error) {

            console.error(
                "GET messages utilisateur :",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Impossible de récupérer vos messages."
            });
        }
    }
);


/* ============================================================
   24.20 MESSAGE UTILISATEUR PAR ID
============================================================ */

app.get(
    "/api/utilisateurs/:userId/messages/:messageId",
    async (req, res) => {

        try {

            const userId =
                getMessageId(
                    req.params.userId
                );

            const messageId =
                getMessageId(
                    req.params.messageId
                );


            if (
                !userId ||
                !messageId
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant invalide."
                });
            }


            const user =
                await getMessageUserById(
                    userId
                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable."
                });
            }


            const premium =
                messageUserIsPremium(
                    user
                );


            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM messages

                    WHERE id = $1

                    AND
                    (
                        recipient_user_id = $2

                        OR

                        (
                            LOWER(
                                COALESCE(
                                    type,
                                    ''
                                )
                            ) = 'official'

                            AND
                            LOWER(
                                COALESCE(
                                    audience,
                                    ''
                                )
                            ) = 'all'
                        )

                        OR

                        (
                            LOWER(
                                COALESCE(
                                    type,
                                    ''
                                )
                            ) = 'official'

                            AND
                            LOWER(
                                COALESCE(
                                    audience,
                                    ''
                                )
                            ) = 'standard'

                            AND
                            $3 = FALSE
                        )

                        OR

                        (
                            LOWER(
                                COALESCE(
                                    type,
                                    ''
                                )
                            ) = 'official'

                            AND
                            LOWER(
                                COALESCE(
                                    audience,
                                    ''
                                )
                            ) = 'premium'

                            AND
                            $3 = TRUE
                        )
                    )

                    LIMIT 1
                    `,
                    [
                        messageId,
                        userId,
                        premium
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Message introuvable."
                });
            }


            return res.json({

                success: true,

                message:
                    formatMessageForUser(
                        result.rows[0]
                    )
            });


        } catch (error) {

            console.error(
                "GET message utilisateur :",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Impossible de récupérer le message."
            });
        }
    }
);


/* ============================================================
   24.21 MARQUER MESSAGE COMME LU
============================================================ */

app.patch(
    "/api/utilisateurs/:userId/messages/:messageId/read",
    async (req, res) => {

        try {

            const userId =
                getMessageId(
                    req.params.userId
                );

            const messageId =
                getMessageId(
                    req.params.messageId
                );


            if (
                !userId ||
                !messageId
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant invalide."
                });
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

                        AND
                        recipient_user_id = $2

                    RETURNING *
                    `,
                    [
                        messageId,
                        userId
                    ]
                );


            /*
             * Message personnel.
             */

            if (
                result.rows.length > 0
            ) {

                return res.json({

                    success: true,

                    message:
                        "Message marqué comme lu.",

                    data:
                        formatMessageForUser(
                            result.rows[0]
                        )
                });
            }


            /*
             * Annonce officielle.
             *
             * On confirme simplement la lecture.
             *
             * La vraie lecture indépendante
             * par utilisateur sera gérée ensuite
             * avec message_reads.
             */

            const official =
                await pool.query(
                    `
                    SELECT *
                    FROM messages

                    WHERE id = $1

                    AND LOWER(
                        COALESCE(
                            type,
                            ''
                        )
                    ) = 'official'

                    LIMIT 1
                    `,
                    [messageId]
                );


            if (
                official.rows.length > 0
            ) {

                return res.json({

                    success: true,

                    message:
                        "Annonce ouverte."
                });
            }


            return res.status(404).json({

                success: false,

                message:
                    "Message introuvable."
            });


        } catch (error) {

            console.error(
                "PATCH message read :",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Impossible de marquer le message comme lu."
            });
        }
    }
);


/* ============================================================
   24.22 COMPATIBILITÉ
   PATCH /api/messages/:id/read
============================================================ */

app.patch(
    "/api/messages/:id/read",
    async (req, res) => {

        try {

            const messageId =
                getMessageId(
                    req.params.id
                );


            if (!messageId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant message invalide."
                });
            }


            const result =
                await pool.query(
                    `
                    UPDATE messages

                    SET
                        status = 'read',
                        read_at = NOW(),
                        updated_at = NOW()

                    WHERE id = $1

                    RETURNING *
                    `,
                    [messageId]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Message introuvable."
                });
            }


            return res.json({

                success: true,

                message:
                    "Message marqué comme lu.",

                data:
                    formatMessageForUser(
                        result.rows[0]
                    )
            });


        } catch (error) {

            console.error(
                "PATCH /api/messages/:id/read :",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Impossible de modifier le message."
            });
        }
    }
);


/* ============================================================
   24.23 TRAITEMENT RÉPONSE UTILISATEUR
============================================================ */

async function processUserMessageReply(
    userId,
    messageId,
    content
) {

    const id =
        getMessageId(userId);

    const originalId =
        getMessageId(messageId);

    const text =
        cleanMessageText(
            content,
            5000
        );


    if (!id) {

        throw new Error(
            "Utilisateur invalide."
        );
    }


    if (!originalId) {

        throw new Error(
            "Message invalide."
        );
    }


    if (!text) {

        throw new Error(
            "La réponse ne peut pas être vide."
        );
    }


    const user =
        await getMessageUserById(
            id
        );


    if (!user) {

        throw new Error(
            "Utilisateur introuvable."
        );
    }


    /*
     * IMPORTANT :
     *
     * L'utilisateur ne peut répondre
     * qu'à un message qui lui appartient.
     */

    const originalResult =
        await pool.query(
            `
            SELECT *
            FROM messages

            WHERE
                id = $1

                AND
                recipient_user_id = $2

            LIMIT 1
            `,
            [
                originalId,
                id
            ]
        );


    if (
        originalResult.rows.length === 0
    ) {

        throw new Error(
            "Vous ne pouvez pas répondre à ce message."
        );
    }


    const original =
        originalResult.rows[0];


    /*
     * Interdire réponse aux annonces.
     */

    if (
        String(
            original.type || ""
        ).toLowerCase() === "official"
    ) {

        throw new Error(
            "Les annonces officielles ne peuvent pas recevoir de réponse."
        );
    }


    /*
     * Interdire réponse à une réponse.
     */

    if (
        String(
            original.type || ""
        ).toLowerCase() === "user_reply"
    ) {

        throw new Error(
            "Vous ne pouvez pas répondre à cette réponse."
        );
    }


    /*
     * Vérifier que le message vient bien
     * de l'administration.
     */

    if (
        String(
            original.sender_type || ""
        ).toLowerCase() !== "admin"
    ) {

        throw new Error(
            "Ce message ne peut pas recevoir de réponse."
        );
    }


    /*
     * Insérer la réponse.
     */

    const result =
        await pool.query(
            `
            INSERT INTO messages (

                sender_type,
                sender_user_id,
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

                status,

                created_at,
                updated_at

            )

            VALUES (

                'user',
                $1,
                $2,
                $3,

                $1,
                'BMJ SERVICE',
                $4,

                $5,
                $6,

                'user_reply',
                'normal',
                'admin',

                'unread',

                NOW(),
                NOW()
            )

            RETURNING *
            `,
            [

                user.id,

                user.nom ||
                    "Utilisateur",

                user.email ||
                    "",

                getAdminEmail(),

                `Réponse : ${
                    original.subject ||
                    "Message"
                }`,

                text
            ]
        );


    const reply =
        formatMessageForUser(
            result.rows[0]
        );


    return reply;
}


/* ============================================================
   24.24 RÉPONSE /repondre
============================================================ */

app.post(
    "/api/utilisateurs/:userId/messages/:messageId/repondre",
    async (req, res) => {

        try {

            const reply =
                await processUserMessageReply(
                    req.params.userId,
                    req.params.messageId,
                    req.body?.content
                );


            return res.status(201).json({

                success: true,

                message:
                    "Votre réponse a été envoyée.",

                data:
                    reply
            });


        } catch (error) {

            console.error(
                "POST /repondre :",
                error
            );

            return res.status(400).json({

                success: false,

                message:
                    error.message ||
                    "Impossible d'envoyer votre réponse."
            });
        }
    }
);


/* ============================================================
   24.25 RÉPONSE /reply
   COMPATIBILITÉ AVEC TON SCRIPT ACTUEL
============================================================ */

app.post(
    "/api/utilisateurs/:userId/messages/:messageId/reply",
    async (req, res) => {

        try {

            const reply =
                await processUserMessageReply(
                    req.params.userId,
                    req.params.messageId,
                    req.body?.content
                );


            return res.status(201).json({

                success: true,

                message:
                    "Votre réponse a été envoyée.",

                data:
                    reply
            });


        } catch (error) {

            console.error(
                "POST /reply :",
                error
            );

            return res.status(400).json({

                success: false,

                message:
                    error.message ||
                    "Impossible d'envoyer votre réponse."
            });
        }
    }
);


/* ============================================================
   24.26 COMPATIBILITÉ
   POST /api/messages/reply
============================================================ */

app.post(
    "/api/messages/reply",
    async (req, res) => {

        try {

            const userId =
                req.body?.user_id ||
                req.body?.userId;


            const messageId =
                req.body?.message_id ||
                req.body?.messageId;


            const reply =
                await processUserMessageReply(
                    userId,
                    messageId,
                    req.body?.content
                );


            return res.status(201).json({

                success: true,

                message:
                    "Votre réponse a été envoyée.",

                data:
                    reply
            });


        } catch (error) {

            console.error(
                "POST /api/messages/reply :",
                error
            );

            return res.status(400).json({

                success: false,

                message:
                    error.message ||
                    "Impossible d'envoyer votre réponse."
            });
        }
    }
);


/* ============================================================
   24.27 CONVERSATION ADMIN / UTILISATEUR
============================================================ */

app.get(
    "/api/admin/messages/user/:userId",
    adminAuth,
    async (req, res) => {

        try {

            const userId =
                getMessageId(
                    req.params.userId
                );


            if (!userId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Utilisateur invalide."
                });
            }


            const user =
                await getMessageUserById(
                    userId
                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable."
                });
            }


            const result =
                await pool.query(
                    `
                    SELECT *

                    FROM messages

                    WHERE

                        /*
                         * Messages envoyés à l'utilisateur
                         */
                        recipient_user_id = $1

                        OR

                        /*
                         * Réponses envoyées
                         * par cet utilisateur à l'administration.
                         */
                        (
                            sender_user_id = $1

                            AND

                            LOWER(
                                COALESCE(
                                    sender_type,
                                    ''
                                )
                            ) = 'user'
                        )

                    ORDER BY
                        created_at ASC,
                        id ASC
                    `,
                    [userId]
                );


            return res.json({

                success: true,

                user,

                messages:
                    result.rows,

                count:
                    result.rows.length
            });


        } catch (error) {

            console.error(
                "Conversation admin utilisateur :",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Impossible de récupérer la conversation."
            });
        }
    }
);


/* ============================================================
   24.28 SSE
   MESSAGERIE INSTANTANÉE
============================================================ */

app.get(
    "/api/utilisateurs/:userId/messages/stream",
    async (req, res) => {

        const userId =
            getMessageId(
                req.params.userId
            );


        if (!userId) {

            return res.status(400).json({

                success: false,

                message:
                    "Utilisateur invalide."
            });
        }


        try {

            /*
             * Vérifier utilisateur.
             */

            const user =
                await getMessageUserById(
                    userId
                );


            if (!user) {

                return res.status(404).end();
            }


            /*
             * Headers SSE.
             */

            res.status(200);

            res.setHeader(
                "Content-Type",
                "text/event-stream"
            );

            res.setHeader(
                "Cache-Control",
                "no-cache, no-transform"
            );

            res.setHeader(
                "Connection",
                "keep-alive"
            );

            res.setHeader(
                "X-Accel-Buffering",
                "no"
            );


            if (
                typeof res.flushHeaders ===
                "function"
            ) {

                res.flushHeaders();
            }


            /*
             * Enregistrer le navigateur.
             */

            if (
                !messageSSEClients.has(
                    userId
                )
            ) {

                messageSSEClients.set(
                    userId,
                    new Set()
                );
            }


            const clients =
                messageSSEClients.get(
                    userId
                );


            clients.add(res);


            /*
             * Confirmation immédiate.
             */

            res.write(
                "event: connected\n"
            );

            res.write(
                `data: ${JSON.stringify({
                    success: true,
                    user_id: userId
                })}\n\n`
            );


            /*
             * Keep-alive.
             */

            const heartbeat =
                setInterval(
                    () => {

                        try {

                            res.write(
                                `: heartbeat ${Date.now()}\n\n`
                            );

                        } catch {

                            clearInterval(
                                heartbeat
                            );

                            clients.delete(
                                res
                            );
                        }

                    },
                    20000
                );


            /*
             * Fermeture connexion.
             */

            req.on(
                "close",
                () => {

                    clearInterval(
                        heartbeat
                    );


                    clients.delete(
                        res
                    );


                    if (
                        clients.size === 0
                    ) {

                        messageSSEClients.delete(
                            userId
                        );
                    }
                }
            );


        } catch (error) {

            console.error(
                "SSE messagerie :",
                error
            );

            try {
                res.end();
            } catch {}
        }
    }
);


/* ============================================================
   24.29 INITIALISATION
============================================================ */

initializeMessageDatabase()
    .catch(error => {

        console.error(
            "❌ Erreur initialisation messagerie :",
            error
        );
    });


console.log(
    "✓ Messagerie BMJ SERVICE chargée."
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