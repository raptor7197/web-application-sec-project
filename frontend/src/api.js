import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default {
  async getNotes() {
    const { data } = await client.get('/notes');
    return data;
  },

  async getNote(id) {
    const { data } = await client.get(`/notes/${id}`);
    return data;
  },

  async createNote(title, content) {
    const { data } = await client.post('/notes', { title, content });
    return data;
  },

  async updateNote(id, title, content) {
    const { data } = await client.put(`/notes/${id}`, { title, content });
    return data;
  },

  async deleteNote(id) {
    const { data } = await client.delete(`/notes/${id}`);
    return data;
  },

  async searchNotes(query) {
    const { data } = await client.get(`/notes/search?q=${encodeURIComponent(query)}`);
    return data;
  },

  async healthCheck() {
    const { data } = await client.get('/health');
    return data;
  },
};
