const fs = require('fs');
const path = require('path');

class JsonDB {
    constructor(filePath) {
        this.filePath = filePath;
        this.data = {};
        this.load();
    }

    load() {
        if (!fs.existsSync(this.filePath)) {
            // Create directory if it doesn't exist
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            this.save();
        } else {
            try {
                const fileContent = fs.readFileSync(this.filePath, 'utf-8');
                this.data = JSON.parse(fileContent);
            } catch (err) {
                console.error("Database load error:", err);
                this.data = {};
            }
        }
    }

    save() {
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    }

    get(key) {
        return this.data[key];
    }

    set(key, value) {
        this.data[key] = value;
        this.save();
    }

    delete(key) {
        delete this.data[key];
        this.save();
    }

    // Advanced nested get (e.g., get("guildId.channel"))
    getDeep(guildId, key) {
        if (!this.data[guildId]) return null;
        return this.data[guildId][key];
    }

    // Advanced nested set
    setDeep(guildId, key, value) {
        if (!this.data[guildId]) this.data[guildId] = {};
        this.data[guildId][key] = value;
        this.save();
    }
}

// Initialize the DB instance
const db = new JsonDB(path.join(__dirname, '../data/database.json'));

module.exports = db;
