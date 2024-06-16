import bot from './bot'; 
import express from 'express';

const token = process.env.TELEGRAM_TOKEN;
const PORT = process.env.PORT || 8080;
const app = express();

app.use(express.json());

app.post(`/bot${token}`, (req, res) => {
  console.log(req);
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  bot.setWebHook(`https://tennis-lisboa-000a7355ff89.herokuapp.com/bot${token}`);
});