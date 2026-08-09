import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const posts = await kv.get('park_posts') || [];
            return res.status(200).json({ posts });
        } catch (error) {

            return res.status(200).json({ posts: [] });
        }
    }
    if (req.method === 'POST') {
        const { password, category, title, image, summary } = req.body;
        if (!password || password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Invalid admin password.' });
        }

        if (!title || !summary) {
            return res.status(400).json({ error: 'Title and summary are required.' });
        }

        const newPost = {
            id: Date.now().toString(),
            category: category || 'News',
            title,
            image: image || null,
            summary,
            date: new Date().toISOString()
        };

        try {
            const existingPosts = await kv.get('park_posts') || [];
            const updatedPosts = [newPost, ...existingPosts];

            await kv.set('park_posts', updatedPosts);

            return res.status(201).json({ message: 'Story published successfully!', post: newPost });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to write to database. Ensure Vercel KV is attached.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
