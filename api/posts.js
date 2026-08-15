import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const rawPosts = await redis.get('park_posts');
            const posts = rawPosts ? JSON.parse(rawPosts) : [];
            return res.status(200).json({ posts });
        } catch (error) {
            return res.status(200).json({ posts: [] });
        }
    }

    if (req.method === 'POST') {
        const { password, category, title, image, summary, content } = req.body;

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
            content: content || '',
            date: new Date().toISOString()
        };

        try {
            const rawPosts = await redis.get('park_posts');
            const existingPosts = rawPosts ? JSON.parse(rawPosts) : [];
            const updatedPosts = [newPost, ...existingPosts];

            await redis.set('park_posts', JSON.stringify(updatedPosts));

            return res.status(201).json({ message: 'Story published successfully!', post: newPost });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to write to database. Check REDIS_URL.' });
        }
    }

    if (req.method === 'DELETE') {
        const { password, id } = req.body;

        if (!password || password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Invalid admin password.' });
        }

        if (!id) {
            return res.status(400).json({ error: 'Post ID is required.' });
        }

        try {
            const rawPosts = await redis.get('park_posts');
            const existingPosts = rawPosts ? JSON.parse(rawPosts) : [];
            const updatedPosts = existingPosts.filter(p => p.id !== id);

            if (updatedPosts.length === existingPosts.length) {
                return res.status(404).json({ error: 'Post not found.' });
            }

            await redis.set('park_posts', JSON.stringify(updatedPosts));
            return res.status(200).json({ message: 'Post deleted.' });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to delete post.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
