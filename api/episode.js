const { getEpisode } = require('../lib/melolo');

module.exports = async (req, res) => {
  const id = String(req.query.id || '');
  const ep = parseInt(req.query.ep, 10) || 1;
  if (!/^\d{5,25}$/.test(id)) return res.status(400).json({ success: false, error: 'ID drama tidak valid' });
  if (ep < 1 || ep > 999) return res.status(400).json({ success: false, error: 'Nomor episode tidak valid' });
  try {
    const data = await getEpisode(id, ep);
    // link stream bisa kedaluwarsa, jadi cache-nya pendek saja
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(200).json({ success: true, ...data });
  } catch (e) {
    res.status(502).json({ success: false, error: e.message });
  }
};
