import { api } from './api'

const port = 3000;

api.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});