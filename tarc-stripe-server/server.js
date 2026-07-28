require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

// Temporary price lookup (we will connect this to your Google Sheet later)
const PRICE_LOOKUP = {
  "BD552i-BT-U1": 439.50,
  "HY-HP602": 577.50,
  "BP2002": 112.70,
  "CH10L30": 42.10,
  "SM27W2": 165.30,
  "EHW08": 150.20,
  "POA121": 127.60
};

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { items } = req.body; // expects [{ model: "HY-HP602", quantity: 1 }, ...]

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const line_items = items.map(item => {
      const price = PRICE_LOOKUP[item.model];
      if (!price) {
        throw new Error(`Price not found for model: ${item.model}`);
      }

      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.model,
          },
          unit_amount: Math.round(price * 100), // Stripe uses cents
        },
        quantity: item.quantity || 1,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
success_url: 'https://kklyberg.github.io/TA-Radio-Website/success.html',
cancel_url: 'https://kklyberg.github.io/TA-Radio-Website/cancel.html',
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on http://localhost:${process.env.PORT}`);
});
