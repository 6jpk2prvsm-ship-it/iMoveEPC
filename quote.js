'use strict';

const form = document.querySelector('#quote-form');
const send = document.querySelector('#send');
const postcode = document.querySelector('#postcode');
const error = document.querySelector('#form-error');
const confirmation = document.querySelector('#confirmation');
const again = document.querySelector('#again');
const preview = document.body.hasAttribute('data-preview');
let lastPayload;
let requestId;
const postcodePattern = /^(?:GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/;

postcode.addEventListener('input', () => postcode.setCustomValidity(''));
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (send.disabled) return;
  error.textContent = '';
  const compact = postcode.value.toUpperCase().replace(/\s/g, '');
  if (!postcodePattern.test(compact)) {
    postcode.setCustomValidity('Enter a UK postcode, such as FY6 7AA.');
    postcode.reportValidity();
    return;
  }
  const fields = new FormData(form);
  fields.set('postcode', compact.slice(0, -3) + ' ' + compact.slice(-3));
  send.disabled = true;
  send.textContent = preview ? 'Checking…' : 'Sending…';

  try {
    if (!preview) {
      const payload = JSON.stringify(Object.fromEntries(fields));
      if (payload !== lastPayload) {
        requestId = crypto.randomUUID();
        lastPayload = payload;
      }
      const response = await fetch(form.action, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Accept: 'application/json', 'Idempotency-Key': requestId},
        body: payload,
        signal: AbortSignal.timeout(15000)
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        error.textContent = result.error || 'We couldn’t send your request. Try again or email Marc directly.';
        return;
      }
      form.reset();
      lastPayload = undefined;
    }
    document.querySelector('#result-title').textContent = preview ? 'Preview complete' : 'Quote request sent';
    document.querySelector('#result-copy').textContent = preview
      ? 'This is the confirmation a visitor would see. Your sample request stayed in this browser.'
      : 'Thanks for getting in touch. Marc will reply by email to confirm the next steps.';
    again.textContent = preview ? 'Edit sample details' : 'Send another request';
    form.hidden = true;
    confirmation.hidden = false;
    confirmation.focus();
  } catch {
    error.textContent = 'We couldn’t confirm your request was sent. You can email Marc directly.';
  } finally {
    send.disabled = false;
    send.textContent = preview ? 'Preview quote request' : 'Send quote request';
  }
});

again.addEventListener('click', () => {
  confirmation.hidden = true;
  form.hidden = false;
  form.elements.name.focus();
});

if (preview) send.textContent = 'Preview quote request';
send.disabled = false;
