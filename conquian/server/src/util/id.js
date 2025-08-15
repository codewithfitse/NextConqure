const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function rid(length = 8) {
	let out = '';
	for (let i = 0; i < length; i++) {
		out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
	}
	return out;
}

module.exports = { rid };


