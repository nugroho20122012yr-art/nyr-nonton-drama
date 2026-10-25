const { getDrama } = require('../lib/melolo');

module.exports = async (req, res) => {
  const id = String(req.query.id || '');
  if (!/^\d{5,25}$/.test(id)) return res.status(400).json({ success: false, error: 'ID drama tidak valid' });
  try {
    const data = await getDrama(id);
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    res.status(200).json({ success: true, ...data });
  } catch (e) {
    res.status(502).json({ success: false, error: e.message });
  }
};
