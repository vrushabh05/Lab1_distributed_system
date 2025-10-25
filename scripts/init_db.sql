-- Initialize schema for Airbnb Lab 1 (MySQL 8.x)

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role ENUM('TRAVELER','OWNER') NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(40),
  about TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  languages VARCHAR(255),
  gender VARCHAR(40),
  avatar_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS properties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  title VARCHAR(160) NOT NULL,
  type VARCHAR(80) NOT NULL,
  description TEXT,
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  price_per_night DECIMAL(10,2) NOT NULL,
  bedrooms INT DEFAULT 1,
  bathrooms INT DEFAULT 1,
  max_guests INT DEFAULT 1,
  amenities JSON,
  photos JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  traveler_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  guests INT NOT NULL,
  status ENUM('PENDING','ACCEPTED','CANCELLED') DEFAULT 'PENDING',
  total_price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (traveler_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_property_dates (property_id, start_date, end_date),
  INDEX idx_traveler (traveler_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  traveler_id INT NOT NULL,
  property_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_fav (traveler_id, property_id),
  FOREIGN KEY (traveler_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- session table for express-mysql-session
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY,
  expires INT(11) UNSIGNED NOT NULL,
  data TEXT
) ENGINE=InnoDB;

-- Simple seed (optional)
INSERT INTO users (role, name, email, password_hash, city, country)
VALUES ('OWNER', 'Demo Owner', 'owner@example.com', '$2b$10$JbVwoxpYkQShYd6mxTIYpu6Kf6W3lBxiM/0a7i3oQw5bJ9iIY2vMy', 'San Jose', 'USA'),
       ('TRAVELER', 'Demo Traveler', 'traveler@example.com', '$2b$10$JbVwoxpYkQShYd6mxTIYpu6Kf6W3lBxiM/0a7i3oQw5bJ9iIY2vMy', 'San Jose', 'USA');
-- note: password for both = "password123"
