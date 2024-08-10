import express, { Express, Request, Response } from 'express';

const app: Express = express();
const port = 3000;

// catch all unhandled errors
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/', asyncHandler(async (req: Request, res: Response) => {
    res.send("zkDemocracy")
}))

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('Sorry! Something bad happened. :(');
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});