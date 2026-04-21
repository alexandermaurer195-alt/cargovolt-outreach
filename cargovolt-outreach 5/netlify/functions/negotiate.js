exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const originalPrompt = body.messages && body.messages[0] ? body.messages[0].content : '';

    const vossAddendum = '\n\nCRITICAL REQUIREMENT: You MUST use the phrase "Are you against" in your reply when making a counter offer. This is non-negotiable. Example: "Are you against doing this at $550?" Never say "how about we meet in the middle" or split the difference. Lead with an accusation audit acknowledging their number, then use "Are you against [your target rate]?", then give one brief reason, then optionally close with a calibrated question like "What would it take to make this work?"';

    const enhancedPrompt = originalPrompt + vossAddendum;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: enhancedPrompt }]
      })
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
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
