import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const POLLS_KEY = 'park_polls';

async function getPolls() {
    const raw = await redis.get(POLLS_KEY);
    return raw ? JSON.parse(raw) : [];
}

async function setPolls(polls) {
    await redis.set(POLLS_KEY, JSON.stringify(polls));
}

function clientIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) return xff.split(',')[0].trim();
    if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
    return 'unknown';
}

function publicPoll(poll) {
    if (!poll) return null;
    const options = poll.options.map(o => ({
        id: o.id,
        text: o.text,
        votes: poll.votes[o.id] || 0
    }));
    const totalVotes = options.reduce((sum, o) => sum + o.votes, 0);
    return { id: poll.id, postId: poll.postId, question: poll.question, options, totalVotes };
}

async function handleSave(res, { password, postId, question, options }) {
    if (!password || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid admin password.' });
    }
    if (!postId) {
        return res.status(400).json({ error: 'Post ID is required.' });
    }

    try {
        const polls = await getPolls();
        const existing = polls.find(p => p.postId === postId);

        const cleanedOptions = Array.isArray(options)
            ? options.map(o => (o || '').trim()).filter(o => o.length > 0)
            : [];

        if (!question || !question.trim() || cleanedOptions.length < 2) {
            const remaining = polls.filter(p => p.postId !== postId);
            await setPolls(remaining);
            return res.status(200).json({ message: 'Poll removed.', poll: null });
        }

        const votes = {};
        const newOptions = cleanedOptions.map(text => {
            const match = existing ? existing.options.find(o => o.text === text) : null;
            const id = match ? match.id : Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            votes[id] = match && existing.votes ? (existing.votes[match.id] || 0) : 0;
            return { id, text };
        });

        const poll = existing || { id: Date.now().toString(), postId, voters: [] };
        poll.postId = postId;
        poll.question = question.trim();
        poll.options = newOptions;
        poll.votes = votes;
        poll.updatedAt = new Date().toISOString();

        await setPolls([poll, ...polls.filter(p => p.postId !== postId)]);
        return res.status(200).json({ message: 'Poll saved.', poll: publicPoll(poll) });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to save poll.' });
    }
}

async function handleVote(req, res, postId, optionId) {
    if (!postId || !optionId) {
        return res.status(400).json({ error: 'Post ID and option are required.' });
    }

    const ip = clientIp(req);

    try {
        const polls = await getPolls();
        const poll = polls.find(p => p.postId === postId);
        if (!poll) {
            return res.status(404).json({ error: 'Poll not found.' });
        }
        if (!poll.options.some(o => o.id === optionId)) {
            return res.status(400).json({ error: 'Invalid option.' });
        }
        if (!Array.isArray(poll.voters)) poll.voters = [];
        if (poll.voters.includes(ip)) {
            return res.status(409).json({ error: 'You have already voted.', poll: publicPoll(poll), hasVoted: true });
        }

        poll.votes = poll.votes || {};
        poll.votes[optionId] = (poll.votes[optionId] || 0) + 1;
        poll.voters.push(ip);

        await setPolls(polls);
        return res.status(200).json({ message: 'Vote counted!', poll: publicPoll(poll), hasVoted: true });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to record vote.' });
    }
}

export default async function handler(req, res) {
    if (req.method === 'GET') {
        const postId = req.query && req.query.postId;
        try {
            const polls = await getPolls();
            const poll = polls.find(p => p.postId === postId) || null;
            const ip = clientIp(req);
            const hasVoted = poll && Array.isArray(poll.voters) && poll.voters.includes(ip);
            return res.status(200).json({ poll: publicPoll(poll), hasVoted: !!hasVoted });
        } catch (error) {
            return res.status(200).json({ poll: null, hasVoted: false });
        }
    }

    if (req.method === 'POST') {
        const { password, postId, question, options, optionId } = req.body || {};
        if (optionId !== undefined) {
            return handleVote(req, res, postId, optionId);
        }
        return handleSave(res, { password, postId, question, options });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
