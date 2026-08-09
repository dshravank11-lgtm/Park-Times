import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export default async function handler(req, res) {

    if (req.method === 'GET') {
        const { postId } = req.query;

        if (!postId) {
            return res.status(400).json({ error: 'postId is required.' });
        }

        try {
            const rawComments = await redis.get(`comments_${postId}`);
            const comments = rawComments ? JSON.parse(rawComments) : [];
            return res.status(200).json({ comments });
        } catch (error) {
            return res.status(200).json({ comments: [] });
        }
    }

    if (req.method === 'POST') {
        const { postId, name, text } = req.body;

        if (!postId || !name || !text) {
            return res.status(400).json({ error: 'postId, name, and text are required.' });
        }

        if (name.trim().length < 1 || name.trim().length > 50) {
            return res.status(400).json({ error: 'Name must be between 1 and 50 characters.' });
        }

        if (text.trim().length < 1 || text.trim().length > 500) {
            return res.status(400).json({ error: 'Comment must be between 1 and 500 characters.' });
        }

        const newComment = {
            id: Date.now().toString(),
            postId,
            name: name.trim(),
            text: text.trim(),
            date: new Date().toISOString()
        };

        try {
            const rawComments = await redis.get(`comments_${postId}`);
            const existing = rawComments ? JSON.parse(rawComments) : [];
            const updated = [...existing, newComment];

            await redis.set(`comments_${postId}`, JSON.stringify(updated));
            return res.status(201).json({ comment: newComment });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to save comment.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}