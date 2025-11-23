// Seed script to populate the database with sample properties
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:adminpassword@localhost:7017/airbnb?authSource=admin';

const sampleProperties = [
    {
        title: 'Traditional Machiya House',
        type: 'House',
        description: 'Experience authentic Japanese living in this beautifully restored traditional machiya townhouse in the heart of Kyoto. Features include tatami rooms, a peaceful zen garden, and modern amenities while preserving historical charm.',
        address: '123 Gion District',
        city: 'Kyoto',
        state: 'Kyoto Prefecture',
        country: 'Japan',
        pricePerNight: 280,
        bedrooms: 3,
        bathrooms: 2,
        maxGuests: 6,
        amenities: ['WiFi', 'Traditional Bath', 'Zen Garden', 'Kitchen', 'AC', 'Washer'],
        photos: [
            'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80',
            'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80',
            'https://images.unsplash.com/photo-1480796927426-f609979314bd?w=800&q=80'
        ],
        ownerId: 'seed-owner-1',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        title: 'Modern Tokyo Apartment with City Views',
        type: 'Apartment',
        description: 'Stunning high-rise apartment in Shibuya with panoramic views of Tokyo skyline. Walking distance to Shibuya Crossing, shopping, and nightlife. Perfect for experiencing the energy of Tokyo.',
        address: '456 Shibuya',
        city: 'Tokyo',
        state: 'Tokyo',
        country: 'Japan',
        pricePerNight: 350,
        bedrooms: 2,
        bathrooms: 2,
        maxGuests: 4,
        amenities: ['WiFi', 'City View', 'Gym', 'Concierge', 'AC', 'Elevator'],
        photos: [
            'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
            'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800&q=80',
            'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80'
        ],
        ownerId: 'seed-owner-2',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        title: 'Cliffside Villa with Infinity Pool',
        type: 'Villa',
        description: 'Breathtaking luxury villa perched on the cliffs of Santorini with stunning caldera views. Features an infinity pool, outdoor dining area, and direct access to the Aegean Sea.',
        address: 'Oia Village',
        city: 'Santorini',
        state: 'South Aegean',
        country: 'Greece',
        pricePerNight: 450,
        bedrooms: 4,
        bathrooms: 3,
        maxGuests: 8,
        amenities: ['WiFi', 'Pool', 'Ocean View', 'Outdoor Kitchen', 'Hot Tub', 'Parking'],
        photos: [
            'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800&q=80',
            'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80',
            'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=800&q=80'
        ],
        ownerId: 'seed-owner-3',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        title: 'Beachfront Eco-Lodge',
        type: 'House',
        description: 'Sustainable beachfront property in Tulum with direct beach access. Built with eco-friendly materials, solar power, and rainwater collection. Perfect for nature lovers seeking luxury and sustainability.',
        address: 'Tulum Beach Road',
        city: 'Tulum',
        state: 'Quintana Roo',
        country: 'Mexico',
        pricePerNight: 320,
        bedrooms: 3,
        bathrooms: 2,
        maxGuests: 6,
        amenities: ['WiFi', 'Beach Access', 'Solar Power', 'Outdoor Shower', 'Hammocks', 'Bicycle'],
        photos: [
            'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80',
            'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
            'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80'
        ],
        ownerId: 'seed-owner-4',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        title: 'Glass Igloo Northern Lights',
        type: 'Villa',
        description: 'Unique glass igloo in Iceland designed for viewing the Northern Lights from the comfort of your bed. Heated floors, luxury amenities, and guided aurora tours available.',
        address: 'Golden Circle',
        city: 'Reykjavik',
        state: 'Capital Region',
        country: 'Iceland',
        pricePerNight: 520,
        bedrooms: 1,
        bathrooms: 1,
        maxGuests: 2,
        amenities: ['WiFi', 'Heated Floors', 'Northern Lights View', 'Hot Tub', 'Restaurant', 'Tour Guide'],
        photos: [
            'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
            'https://images.unsplash.com/photo-1531756716853-09a60d38d820?w=800&q=80',
            'https://images.unsplash.com/photo-1542718610-a1d656d1884c?w=800&q=80'
        ],
        ownerId: 'seed-owner-5',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        title: 'Luxury Penthouse Manhattan',
        type: 'Apartment',
        description: 'Spectacular penthouse in the heart of Manhattan with 360-degree city views. Features include a private rooftop terrace, chef\'s kitchen, and concierge service.',
        address: '789 Fifth Avenue',
        city: 'New York',
        state: 'New York',
        country: 'USA',
        pricePerNight: 650,
        bedrooms: 3,
        bathrooms: 3,
        maxGuests: 6,
        amenities: ['WiFi', 'City View', 'Rooftop Terrace', 'Concierge', 'Gym', 'Doorman'],
        photos: [
            'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80',
            'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
            'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80'
        ],
        ownerId: 'seed-owner-6',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        title: 'Tuscan Countryside Villa',
        type: 'Villa',
        description: 'Charming stone villa in the heart of Tuscany surrounded by vineyards and olive groves. Features include a wine cellar, outdoor pizza oven, and stunning countryside views.',
        address: 'Via del Chianti',
        city: 'Florence',
        state: 'Tuscany',
        country: 'Italy',
        pricePerNight: 380,
        bedrooms: 5,
        bathrooms: 4,
        maxGuests: 10,
        amenities: ['WiFi', 'Pool', 'Wine Cellar', 'Pizza Oven', 'Garden', 'Parking'],
        photos: [
            'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
            'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
            'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80'
        ],
        ownerId: 'seed-owner-7',
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        title: 'Cozy Mountain Chalet',
        type: 'House',
        description: 'Traditional Swiss chalet in the Alps with ski-in/ski-out access. Features a fireplace, sauna, and panoramic mountain views. Perfect for winter sports enthusiasts.',
        address: 'Alpine Road',
        city: 'Zermatt',
        state: 'Valais',
        country: 'Switzerland',
        pricePerNight: 480,
        bedrooms: 4,
        bathrooms: 3,
        maxGuests: 8,
        amenities: ['WiFi', 'Fireplace', 'Sauna', 'Ski Storage', 'Mountain View', 'Parking'],
        photos: [
            'https://images.unsplash.com/photo-1542718610-a1d656d1884c?w=800&q=80',
            'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
            'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80'
        ],
        ownerId: 'seed-owner-8',
        createdAt: new Date(),
        updatedAt: new Date()
    }
];

async function seedDatabase() {
    let client;
    try {
        console.log('Connecting to MongoDB...');
        client = await MongoClient.connect(MONGODB_URI);
        const db = client.db('airbnb');
        const collection = db.collection('properties');

        console.log('Clearing existing seed properties...');
        await collection.deleteMany({ ownerId: { $regex: /^seed-owner-/ } });

        console.log('Inserting sample properties...');
        const result = await collection.insertMany(sampleProperties);
        console.log(`✅ Successfully inserted ${result.insertedCount} properties`);

        console.log('\nInserted properties:');
        sampleProperties.forEach((prop, index) => {
            console.log(`  ${index + 1}. ${prop.title} - ${prop.city}, ${prop.country} ($${prop.pricePerNight}/night)`);
        });

        console.log('\n✨ Database seeding completed successfully!');
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
            console.log('Database connection closed.');
        }
    }
}

seedDatabase();
