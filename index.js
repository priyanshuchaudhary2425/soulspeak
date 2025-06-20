import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import { marked } from "marked";
import dotenv from "dotenv";
import { db, createTables } from "./database.js";


dotenv.config();
await createTables();
const app = express();
const port = 3000;

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
  }
}));

app.use((req, res, next) => {
  res.locals.username = req.session.username;
  next();
});


app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));



function isAuthenticated(req, res, next) {
    if (req.session && req.session.user_id) {
        next();
    } else {
        res.redirect("/login");
    }
}


app.get("/", async (req, res) => {
    const category = req.query.category;

  try {

    let result;

    if (category && category !== "all") {
        result = await db.query(`
        SELECT contentData.*, users.username
        FROM contentData
        JOIN users ON contentData.user_id = users.user_id
        where category ILIKE $1
        ORDER BY contentData.id DESC
        `, [category]);
    } else {

    result = await db.query(`
      SELECT contentData.*, users.username
      FROM contentData
      JOIN users ON contentData.user_id = users.user_id
      ORDER BY contentData.id DESC
    `);}

    const items = result.rows.map(item => ({
            ...item,
          formattedBody: marked.parse(item.body)  // Convert to HTML
        }));


    res.render("index.ejs", { items });
  }    catch (err) {
  console.error("Error message (short description):", err.stack);
  res.status(500).send("Something went wrong. Please try again later.");
}

});



app.get("/about", async (req, res) => {
    try {
        res.render("about.ejs");
    } catch (err) {
        console.log(err)
    }
});

app.get("/submit", async (req, res) => {
    try {
        res.render("submit.ejs");
    } catch (err) {
        console.log(err)
    }
});

app.post("/submit", async (req, res) => {
     
    const {category, body, title} = req.body;
    const user_id = req.session.user_id ? req.session.user_id : 1;

    try {
        const result = await db.query("insert into contentData (user_id, category, body, title) values ($1, $2, $3, $4)",
            [user_id, category, body, title]
        );

        console.log("Inserted content ID:", result.rows);

        res.redirect("/");
    } catch (err) {
        console.error("Failed to submit new content:", err.stack);
        res.status(500).send("Error while submitting your post. Please try again later.");
    }

});

app.get("/profile", isAuthenticated, async (req, res) => {
    try {

    const result = await db.query(`
      SELECT contentData.*, users.username
      FROM contentData
      JOIN users ON contentData.user_id = users.user_id
      ORDER BY contentData.id DESC
    `);

    const items = result.rows.map(item => ({
            ...item,
          formattedBody: marked.parse(item.body)  
        }));

    res.render("profile.ejs", {items});
    } catch (err) {
        console.log(err);
    }
});

app.get("/register", async (req, res) => {
    try {
        res.render("register.ejs")
    } catch (err) {
        console.error("Error while registering new user:", err.stack);
        res.status(500).send("Registration failed. Please try again later.");
        }

});

app.post("/register", async (req, res) => {

    const {username, password} = req.body;
    try {
        const existingUser = await db.query("select * from users WHERE username = $1", [username]);
        if (existingUser.rows.length > 0) {
            res.send("Account already exist try login...");
        } else {

            const saltround = 10;
            const hashpassword = await bcrypt.hash(password, saltround);

            const result = await db.query("insert into users (username, password) values ($1, $2) RETURNING user_id, username", 
                [username, hashpassword]);

            req.session.user_id = result.rows[0].user_id;
            req.session.username = result.rows[0].username;

            res.redirect("/");
        };
    } catch (err) {
        console.error("Error while registering new user:", err.stack);
        res.status(500).send("Registration failed. Please try again later.");
        }

});

app.get("/login", async (req, res) => {
    try {
        res.render("login.ejs")
    } catch (err) {
        console.error("Login failed due to server error:", err.stack);
        res.status(500).send("Server error during login. Please try again.");
        }

});

app.post("/login", async(req, res) => {
    const {username, password} = req.body;

    try {
        const result = await db.query("select * from users where username = $1", [username]);

        if (result.rows.length === 0) {
            console.log("User Not Found");
             return res.send("User not found please register");
        } else { 
            const user = result.rows[0];
            const isMatched = await bcrypt.compare(password, user.password);

            if (!isMatched) {
                return res.send("Incorrect Password");
            } 

                req.session.user_id = user.user_id;
                req.session.username = user.username;

                res.redirect("/");
            
        }

    } catch (err) {
        console.error("Login failed due to server error:", err.stack);
        res.status(500).send("Server error during login. Please try again.");
    }

});

app.post("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM contentData WHERE id = $1", [id]);
    res.redirect("/");
  } catch (err) {
    res.status(500).send("Error deleting content");
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

