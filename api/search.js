const { search } = require('../lib/melolo');

module.exports = async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (!q) return res.status(400).json({ success: false, error: 'Kata kunci (q) wajib diisi' });
  try {
    const data = await search(q);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ success: false, error: e.message });
  }
};
