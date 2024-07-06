import bot from './bot'; 
import express from 'express';

const token = process.env.TELEGRAM_TOKEN;
const projectUrl = process.env.PROJECT_URL;
const port = process.env.PORT || 8080;

const app = express();

app.use(express.json());

app.post(`/bot${token}`, (req, res) => {
  console.log(req);
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(port, () => {
  const url = `https://${projectUrl}/bot${token}`;
  bot.setWebHook(url);
  console.log(`Server is running on port ${port}`);
});
