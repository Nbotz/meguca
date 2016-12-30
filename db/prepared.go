package db

import "database/sql"

// Stores generated prepared statements
var prepared = map[string]*sql.Stmt{}

// Queries to be converted into prepared statements
var protoPrepared = map[string]string{
	"isLoggedIn": `
		SELECT EXISTS (
			SELECT true FROM sessions
				WHERE account = $1 AND token = $2
		);`,

	"writePost": `
		INSERT INTO posts (
			editing, deleted, spoiler, id, op, time, body, name, trip, auth,
			SHA1, imageName, commands
		) VALUES
			($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,

	"writeImage": `
		INSERT INTO images (
			APNG, audio, video, fileType, thumbType, dims, length, size, MD5,
			SHA1
		) VALUES
			($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,

	"writeOP": `
		INSERT INTO threads (
			board, log, id, postCtr, imageCtr, replyTime, subject
		) VALUES
			($1, $2, $3, $4, $5, $6, $7)`,
	"newPostID": `
		SELECT nextval('post_id')`,

	"getAllBoard": `
		SELECT t.board, t.id, t.postCtr, t.imageCtr, t.replyTime, t.subject,
				p.spoiler, p.time, p.name, p.trip, p.auth, p.imageName,
				(SELECT array_length(t.log, 1)) AS logCtr,
				i.*
			FROM threads AS t
			INNER JOIN posts AS p
				ON t.id = p.id AND p.deleted != 'true'
			LEFT OUTER JOIN images AS i
				ON p.SHA1 = i.SHA1
			ORDER BY replyTime DESC`,
}
