exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { token } = JSON.parse(event.body);
    if (!token) return { statusCode: 400, body: JSON.stringify({ error: 'No token provided' }) };

    // Fetch last 50 messages from inbox, newest first
    const res = await fetch(
      'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime desc&$select=id,subject,from,bodyPreview,receivedDateTime,isRead',
      { headers: { 'Authorization': 'Bearer ' + token } }
    );

    const data = await res.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
