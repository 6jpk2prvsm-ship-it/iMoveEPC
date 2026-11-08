const propertyTypes = new Set(['House', 'Flat or maisonette', 'Bungalow', 'Other']);
const bedroomCounts = new Set(['Studio', '1', '2', '3', '4', '5+']);
const postcodePattern = /^(?:GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/;
const emailPattern = /^[^\s@<>(),;:\x00-\x1F\x7F]+@[^\s@<>(),;:\x00-\x1F\x7F]+\.[^\s@<>(),;:\x00-\x1F\x7F]+$/;
const unavailable = 'We couldn’t send your request. Try again or email Marc directly.';
const reply = (status, payload) => Response.json(payload, {
  status,
  headers: {'Cache-Control': 'no-store'}
});

export async function onRequestPost({request, env}) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    return reply(403, {error: 'Please send your request from the iMove EPC page.'});
  }
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') {
    return reply(415, {error: 'Please use the iMove EPC quote form.'});
  }
  if (Number(request.headers.get('Content-Length')) > 8192) {
    return reply(413, {error: 'Your request is too long.'});
  }

  let fields;
  try {
    const body = await request.text();
    if (body.length > 8192) return reply(413, {error: 'Your request is too long.'});
    fields = JSON.parse(body);
  } catch {
    return reply(400, {error: 'Your request couldn’t be read. Check your details and try again.'});
  }

  const read = key => typeof fields?.[key] === 'string' ? fields[key].trim() : '';
  const name = read('name');
  const email = read('email');
  const postcode = read('postcode').toUpperCase().replace(/\s/g, '');
  const property = read('property');
  const bedrooms = read('bedrooms');
  const notes = read('notes');

  if (read('website')) return reply(200, {ok: true});
  if (!name || name.length > 80 || /[\r\n]/.test(name) ||
      email.length > 120 || !emailPattern.test(email) ||
      !postcodePattern.test(postcode) || !propertyTypes.has(property) ||
      !bedroomCounts.has(bedrooms) || notes.length > 1000) {
    return reply(400, {error: 'Check your name, email and property details, then try again.'});
  }

  const formId = env.FORMSPREE_FORM_ID?.trim();
  if (!formId || !/^[a-z0-9]+$/i.test(formId)) {
    console.warn('Formspree configuration missing or invalid');
    return reply(503, {error: unavailable});
  }

  const submission = new FormData();
  submission.set('name', name);
  submission.set('email', email);
  submission.set('postcode', postcode.slice(0, -3) + ' ' + postcode.slice(-3));
  submission.set('property', property);
  submission.set('bedrooms', bedrooms);
  submission.set('message', notes);

  try {
    const response = await fetch('https://formspree.io/f/' + formId, {
      method: 'POST',
      headers: {Accept: 'application/json'},
      body: submission,
      redirect: 'manual',
      signal: AbortSignal.timeout(8000)
    });

    console.log('Formspree response:', response.status);
    if (response.ok) return reply(200, {ok: true});
    if (response.status === 429) {
      return reply(429, {error: 'The form is busy. Wait a moment or email Marc directly.'});
    }
    return reply(502, {error: unavailable});
  } catch (error) {
    console.error('Formspree request failed:', error.name, error.message);
    return reply(502, {error: 'We couldn’t confirm your request was sent. You can email Marc directly.'});
  }
}
