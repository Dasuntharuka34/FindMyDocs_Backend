
const loginAndFetchAnalytics = async () => {
    try {
        console.log('Attempting login...');
        const loginRes = await fetch('http://127.0.0.1:3000/api/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@findmydocs.com',
                password: 'admin123'
            })
        });

        const loginData = await loginRes.json();
        if (!loginRes.ok) {
            throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
        }

        const token = loginData.token;
        console.log('Login successful, token obtained.');

        console.log('Fetching analytics...');
        const analyticsRes = await fetch('http://127.0.0.1:3000/api/forms/analytics', {
            headers: { Authorization: `Bearer ${token}` }
        });

        const analyticsData = await analyticsRes.json();
        console.log('Analytics Response Status:', analyticsRes.status);
        console.log('Analytics Response:', JSON.stringify(analyticsData, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    }
};

loginAndFetchAnalytics();
