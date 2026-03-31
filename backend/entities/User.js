/**
 * User entity.
 *
 * Wraps a database user row into a clean serialisable shape.
 * The password field is intentionally never assigned to the instance,
 * so toJSON() can never accidentally expose it.
 *
 * @param {Object} row - Raw database user row.
 */
class User {
  constructor(row) {
    this.id        = row.id;
    this.username  = row.username;
    this.email     = row.email;
    this.teamId    = row.teamid;
    this.createdAt = row.created_at;
    this.updatedAt = row.updated_at;
    // row.password is intentionally not assigned
  }

  /** Returns a plain serialisable object safe to send over the wire. */
  toJSON() {
    return {
      id:        this.id,
      username:  this.username,
      email:     this.email,
      teamId:    this.teamId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

module.exports = User;
