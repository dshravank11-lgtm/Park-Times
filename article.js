document.addEventListener('DOMContentLoaded', () => {
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', dateOptions);
    document.getElementById('year').textContent = new Date().getFullYear();
    loadArticle();
});

function hideOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
}

async function loadArticle() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const main = document.getElementById('articleMain');

    if (!id) {
        renderNotFound(main);
        hideOverlay();
        return;
    }

    try {
        const res = await fetch('/api/posts');
        const data = await res.json();
        const posts = data.posts || [];
        const post = posts.find(p => p.id === id);

        if (!post) {
            renderNotFound(main);
        } else {
            renderArticle(main, post);
            loadPoll(id);
            loadComments(id);
        }
    } catch (err) {
        main.innerHTML = '<div class="empty-state">Could not load this story. Check your connection and try again.</div>';
    } finally {
        hideOverlay();
    }
}

function renderNotFound(main) {
    main.innerHTML = `
        <div class="empty-state">
            Story not found.<br>
            <a href="index.html" class="back-link back-link--bottom">&larr; Back to Park Times</a>
        </div>
    `;
}

function renderArticle(main, post) {
    document.title = `${post.title} — Park Times`;

    const dateFormatted = new Date(post.date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    const heroImage = post.image
        ? `<div class="image-wrapper article-hero-image"><img src="${escapeAttr(post.image)}" alt=""></div>`
        : '';

    const body = post.content && post.content.trim()
        ? post.content
        : `<p>${escapeHtml(post.summary)}</p>`;

    main.innerHTML = `
        <span class="label">${escapeHtml(post.category)}</span>
        <h1 class="article-headline">${escapeHtml(post.title)}</h1>
        <div class="article-byline"><span>${dateFormatted}</span></div>
        ${heroImage}
        <div class="article-body">${body}</div>
        <section class="poll-section" id="pollSection"></section>
        <a href="index.html" class="back-link back-link--bottom">&larr; Back to Park Times</a>

        <section class="comments-section" id="commentsSection">
            <h2 class="comments-heading">Comments</h2>
            <form class="comment-form" id="commentForm" onsubmit="handleCommentSubmit(event)">
                <div class="comment-form-row">
                    <input type="text" id="commentName" class="comment-input" placeholder="Your name" maxlength="50" required autocomplete="name">
                    <button type="submit" class="btn-primary comment-submit-btn">Post</button>
                </div>
                <textarea id="commentText" class="comment-textarea" placeholder="Share your thoughts..." maxlength="500" required rows="3"></textarea>
                <label class="disclosure">
                    <input type="checkbox" id="commentRulesCheck">
                    <span>I have read and agree to the <a href="rules.html#user-rules" class="rules-link" target="_blank">Rules</a>.</span>
                </label>
                <p id="commentStatus" class="form-status"></p>
            </form>
            <div id="commentsList" class="comments-list">
                <div class="comments-loading">Loading comments&hellip;</div>
            </div>
        </section>
    `;
}

async function loadComments(postId) {
    const list = document.getElementById('commentsList');
    if (!list) return;

    try {
        const res = await fetch(`/api/comments?postId=${encodeURIComponent(postId)}`);
        const data = await res.json();
        renderComments(data.comments || []);
    } catch (err) {
        list.innerHTML = '<div class="comments-empty">Could not load comments.</div>';
    }
}

function renderComments(comments) {
    const list = document.getElementById('commentsList');
    if (!list) return;

    if (comments.length === 0) {
        list.innerHTML = '<div class="comments-empty">No comments yet. Be the first to share your thoughts.</div>';
        return;
    }

    list.innerHTML = comments.map(c => {
        const date = new Date(c.date).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        return `
            <div class="comment">
                <div class="comment-meta">
                    <span class="comment-author">${escapeHtml(c.name)}</span>
                    <span class="comment-date">${date}</span>
                </div>
                <p class="comment-text">${escapeHtml(c.text)}</p>
            </div>
        `;
    }).join('');
}

async function handleCommentSubmit(event) {
    event.preventDefault();

    const params = new URLSearchParams(window.location.search);
    const postId = params.get('id');
    const name = document.getElementById('commentName').value.trim();
    const text = document.getElementById('commentText').value.trim();
    const status = document.getElementById('commentStatus');
    const btn = event.target.querySelector('.comment-submit-btn');

    if (!document.getElementById('commentRulesCheck').checked) {
        status.style.color = 'var(--red)';
        status.textContent = 'Please confirm you have read the rules.';
        return;
    }

    btn.textContent = 'Posting...';
    btn.disabled = true;
    status.textContent = '';

    try {
        const res = await fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId, name, text })
        });
        const data = await res.json();

        if (res.ok) {
            document.getElementById('commentName').value = '';
            document.getElementById('commentText').value = '';
            status.style.color = '#2f7a3f';
            status.textContent = 'Comment posted!';

            loadComments(postId);
            setTimeout(() => { status.textContent = ''; }, 3000);
        } else {
            status.style.color = 'var(--red)';
            status.textContent = data.error || 'Failed to post comment.';
        }
    } catch (err) {
        status.style.color = 'var(--red)';
        status.textContent = 'Connection error.';
    } finally {
        btn.textContent = 'Post';
        btn.disabled = false;
    }
}

async function loadPoll(postId) {
    const section = document.getElementById('pollSection');
    if (!section) return;

    try {
        const res = await fetch(`/api/polls?postId=${encodeURIComponent(postId)}`);
        const data = await res.json();
        if (data.poll) {
            renderPoll(section, data.poll, data.hasVoted);
        }
    } catch (err) {
        section.innerHTML = '';
    }
}

function renderPoll(section, poll, hasVoted) {
    section.dataset.postId = poll.postId;

    if (hasVoted) {
        const total = poll.totalVotes || 0;
        section.innerHTML = `
            <h2 class="poll-question">${escapeHtml(poll.question)}</h2>
            <div class="poll-results">
                ${poll.options.map(o => {
                    const pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
                    return `
                        <div class="poll-result">
                            <div class="poll-result-label"><span>${escapeHtml(o.text)}</span><span>${pct}%</span></div>
                            <div class="poll-bar"><div class="poll-bar-fill" style="width:${pct}%"></div></div>
                            <div class="poll-result-votes">${o.votes} vote${o.votes === 1 ? '' : 's'}</div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="poll-total">${total} vote${total === 1 ? '' : 's'}</div>
        `;
        return;
    }

    section.innerHTML = `
        <h2 class="poll-question">${escapeHtml(poll.question)}</h2>
        <div class="poll-choices">
            ${poll.options.map(o => `
                <label class="poll-choice">
                    <input type="radio" name="pollOption" value="${escapeAttr(o.id)}">
                    <span>${escapeHtml(o.text)}</span>
                </label>
            `).join('')}
        </div>
        <button type="button" class="btn-primary poll-vote-btn" onclick="submitPollVote()">Vote</button>
        <p class="poll-status form-status"></p>
    `;
}

async function submitPollVote() {
    const section = document.getElementById('pollSection');
    const postId = section.dataset.postId;
    const selected = section.querySelector('input[name="pollOption"]:checked');
    const status = section.querySelector('.poll-status');
    const btn = section.querySelector('.poll-vote-btn');

    if (!selected) {
        status.style.color = 'var(--red)';
        status.textContent = 'Please choose an option.';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Voting...';

    try {
        const res = await fetch('/api/polls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId, optionId: selected.value })
        });
        const data = await res.json();

        if (res.ok || res.status === 409) {
            renderPoll(section, data.poll, true);
        } else {
            btn.disabled = false;
            btn.textContent = 'Vote';
            status.style.color = 'var(--red)';
            status.textContent = data.error || 'Failed to submit vote.';
        }
    } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Vote';
        status.style.color = 'var(--red)';
        status.textContent = 'Connection error.';
    }
}

function escapeHtml(str) {
    return str ? str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])) : '';
}

function escapeAttr(str) {
    return escapeHtml(str);
}
