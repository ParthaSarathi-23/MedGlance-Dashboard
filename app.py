import firebase_admin
from firebase_admin import credentials, firestore
import json
from datetime import datetime, timedelta, timezone
import logging
from collections import defaultdict, Counter
import re
import os
from query_handler import DatabaseQueryHandler
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Firestore
try:
    # Initialize Firebase Admin SDK
    # Replace 'path/to/serviceAccountKey.json' with your actual service account key path
    cred = credentials.Certificate('serviceAccountKey.json')  # You need to add your service account key
    firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    logger.info("Firestore initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Firestore: {e}")
    db = None

class MedicalAnalytics:
    def __init__(self, db):
        self.db = db
    
    def _ensure_timezone_aware(self, dt):
        
        if dt is None:
            return None
        if dt.tzinfo is None:
            # Assume UTC if no timezone info
            return dt.replace(tzinfo=timezone.utc)
        else:
            # Convert to UTC
            return dt.astimezone(timezone.utc)
    
    def get_weekly_active_users(self):
        
        try:
            one_week_ago = datetime.now(timezone.utc) - timedelta(days=7)
            users_ref = self.db.collection('users')
            
            # Get users who logged in within the last week
            query = users_ref.where('last_login', '>=', one_week_ago)
            users = query.stream()
            
            weekly_users = []
            for user in users:
                user_data = user.to_dict()
                last_login = user_data.get('last_login')
                if last_login:
                    last_login = self._ensure_timezone_aware(last_login)
                
                weekly_users.append({
                    'user_id': user_data.get('user_id'),
                    'display_name': user_data.get('display_name'),
                    'last_login': last_login.strftime('%Y-%m-%d %H:%M:%S') if last_login else None
                })
            
            return {
                'count': len(weekly_users),
                'users': weekly_users
            }
        except Exception as e:
            logger.error(f"Error getting weekly active users: {e}")
            return {'count': 0, 'users': []}
    
    def get_user_query_statistics(self):
        
        try:
            users_ref = self.db.collection('users')
            all_users = users_ref.stream()
            
            user_stats = []
            total_queries = 0
            
            for user in all_users:
                user_data = user.to_dict()
                user_id = user_data.get('user_id')
                
                # Get all chats for this user
                chats_ref = self.db.collection_group('chats').where('user_id', '==', user_id)
                chats = chats_ref.stream()
                
                user_query_count = 0
                for chat in chats:
                    chat_data = chat.to_dict()
                    user_query_count += chat_data.get('message_count', 0)
                
                total_queries += user_query_count
                
                last_login = user_data.get('last_login')
                if last_login:
                    last_login = self._ensure_timezone_aware(last_login)

                user_stats.append({
                    'user_id': user_id,
                    'display_name': user_data.get('display_name'),
                    'query_count': user_query_count,
                    'last_login': last_login.strftime('%Y-%m-%d') if last_login else 'Never'
                })
            
            # Sort by query count descending
            user_stats.sort(key=lambda x: x['query_count'], reverse=True)
            
            return {
                'total_queries': total_queries,
                'total_users': len(user_stats),
                'average_queries_per_user': round(total_queries / len(user_stats), 2) if user_stats else 0,
                'user_statistics': user_stats
            }
        except Exception as e:
            logger.error(f"Error getting user query statistics: {e}")
            return {'total_queries': 0, 'total_users': 0, 'average_queries_per_user': 0, 'user_statistics': []}
    
    def get_medicine_search_stats(self, medicine_name=None):
        
        try:
            # Get all conversations
            conversations_ref = self.db.collection_group('conversations')
            conversations = conversations_ref.stream()
            
            medicine_searches = defaultdict(list)
            all_medicines = set()
            
            # Common medicine patterns to search for
            medicine_patterns = [
                r'\b(?:paracetamol|acetaminophen)\b',
                r'\b(?:ibuprofen|advil|motrin)\b',
                r'\b(?:aspirin|acetylsalicylic acid)\b',
                r'\b(?:amoxicillin|amoxil)\b',
                r'\b(?:metformin|glucophage)\b',
                r'\b(?:omeprazole|prilosec)\b',
                r'\b(?:atorvastatin|lipitor)\b',
                r'\b(?:lisinopril|prinivil)\b',
                r'\b(?:metoprolol|lopressor)\b',
                r'\b(?:amlodipine|norvasc)\b'
            ]
            
            for conv in conversations:
                try:
                    conv_data = conv.to_dict()
                    if not conv_data:
                        continue
                        
                    user_message = conv_data.get('user_message', '').lower()
                    bot_message = conv_data.get('bot_response','').lower()

                    # Get user info with proper null checking
                    chat_ref = conv.reference.parent.parent
                    if not chat_ref:
                        continue
                        
                    chat_doc = chat_ref.get()
                    if not chat_doc.exists:
                        continue
                        
                    chat_data = chat_doc.to_dict()
                    if not chat_data:
                        continue
                        
                    user_id = chat_data.get('user_id')
                    if not user_id:
                        continue
                    
                    # Get user details with proper null checking
                    user_ref = self.db.collection('users').where('user_id', '==', user_id).limit(1)
                    user_docs = list(user_ref.stream())
                    user_name = user_id
                    
                    if user_docs:
                        user_doc = user_docs[0]
                        if user_doc.exists:
                            user_data = user_doc.to_dict()
                            if user_data:
                                user_name = user_data.get('display_name', user_id)
                except Exception as e:
                    logger.warning(f"Error processing conversation: {e}")
                    continue
                
                # Check for medicine mentions
                for pattern in medicine_patterns:
                    user_matches = re.findall(pattern, user_message, re.IGNORECASE)
                    bot_matches = re.findall(pattern, bot_message, re.IGNORECASE)
                    for match in user_matches:
                        medicine = match.lower()
                        all_medicines.add(medicine)
                        if user_id not in [u['user_id'] for u in medicine_searches[medicine]]:
                            medicine_searches[medicine].append({
                                'user_id': user_id,
                                'user_name': user_name,
                                'search_context': user_message[:100] + '...' if len(user_message) > 100 else user_message
                            })
                    for match in bot_matches:
                        medicine = match.lower()
                        all_medicines.add(medicine)
                        if user_id not in [u['user_id'] for u in medicine_searches[medicine]]:
                            medicine_searches[medicine].append({
                                'user_id': user_id,
                                'user_name': user_name,
                                'search_context': bot_message[:100] + '...' if len(bot_message) > 100 else bot_message
                            })
            
            # If specific medicine requested, return only that
            if medicine_name:
                medicine_name = medicine_name.lower()
                return {
                    'medicine': medicine_name,
                    'search_count': len(medicine_searches.get(medicine_name, [])),
                    'users': medicine_searches.get(medicine_name, [])
                }
            
            # Return all medicine search statistics
            medicine_stats = []
            for medicine, users in medicine_searches.items():
                medicine_stats.append({
                    'medicine': medicine,
                    'search_count': len(users),
                    'users': users
                })
            
            medicine_stats.sort(key=lambda x: x['search_count'], reverse=True)
            
            return {
                'total_medicines_searched': len(all_medicines),
                'medicine_statistics': medicine_stats
            }
            
        except Exception as e:
            logger.error(f"Error getting medicine search statistics: {e}")
            return {'total_medicines_searched': 0, 'medicine_statistics': []}
    
    def get_daily_user_engagement(self):
        
        try:
            thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
            conversations_ref = self.db.collection_group('conversations')
            conversations = conversations_ref.where('timestamp', '>=', thirty_days_ago).stream()
            
            daily_engagement = defaultdict(int)
            
            for conv in conversations:
                conv_data = conv.to_dict()
                timestamp = conv_data.get('timestamp')
                if timestamp:
                    timestamp = self._ensure_timezone_aware(timestamp)
                    date_key = timestamp.strftime('%Y-%m-%d')
                    daily_engagement[date_key] += 1
            
            # Fill in missing days with 0
            engagement_data = []
            for i in range(30):
                date = (datetime.now(timezone.utc) - timedelta(days=i)).strftime('%Y-%m-%d')
                engagement_data.append({
                    'date': date,
                    'queries': daily_engagement.get(date, 0)
                })
            
            engagement_data.reverse()  # Chronological order
        
            return {
                'daily_engagement': engagement_data,
                'total_queries_30_days': sum(daily_engagement.values()),
                'average_daily_queries': round(sum(daily_engagement.values()) / 30, 2)
            }
            
        except Exception as e:
            logger.error(f"Error getting daily engagement: {e}")
            return {'daily_engagement': [], 'total_queries_30_days': 0, 'average_daily_queries': 0}
    
    def get_user_demographics(self):
        
        try:
            users_ref = self.db.collection('users')
            users = users_ref.stream()
            
            age_groups = defaultdict(int)
            verification_stats = {'verified': 0, 'unverified': 0}
            oauth_providers = defaultdict(int)
            profile_completion = {'complete': 0, 'incomplete': 0}
            
            total_users = 0
            
            for user in users:
                user_data = user.to_dict()
                total_users += 1
                
                # Age demographics
                age = user_data.get('age')
                if age:
                    if age < 18:
                        age_groups['Under 18'] += 1
                    elif age < 25:
                        age_groups['18-24'] += 1
                    elif age < 35:
                        age_groups['25-34'] += 1
                    elif age < 45:
                        age_groups['35-44'] += 1
                    elif age < 55:
                        age_groups['45-54'] += 1
                    elif age < 65:
                        age_groups['55-64'] += 1
                    else:
                        age_groups['65+'] += 1
                
                # Email verification
                if user_data.get('email_verified'):
                    verification_stats['verified'] += 1
                else:
                    verification_stats['unverified'] += 1
                
                # OAuth providers
                provider = user_data.get('oauth_provider', 'Unknown')
                oauth_providers[provider] += 1
                
                # Profile completion
                if user_data.get('profile_complete'):
                    profile_completion['complete'] += 1
                else:
                    profile_completion['incomplete'] += 1
            
            
            return {
                'total_users': total_users,
                'age_distribution': dict(age_groups),
                'verification_stats': verification_stats,
                'oauth_providers': dict(oauth_providers),
                'profile_completion': profile_completion
            }
            
        except Exception as e:
            logger.error(f"Error getting user demographics: {e}")
            return {'total_users': 0, 'age_distribution': {}, 'verification_stats': {}, 'oauth_providers': {}, 'profile_completion': {}}
    
    def get_chat_session_analysis(self):
        
        try:
            chats_ref = self.db.collection_group('chats')
            chats = chats_ref.stream()
            
            session_lengths = []
            total_sessions = 0
            active_sessions = 0
            
            for chat in chats:
                chat_data = chat.to_dict()
                total_sessions += 1
                
                message_count = chat_data.get('message_count', 0)
                session_lengths.append(message_count)
                
                # Consider sessions with >1 message as active
                if message_count > 1:
                    active_sessions += 1
            
            if session_lengths:
                avg_session_length = sum(session_lengths) / len(session_lengths)
                max_session_length = max(session_lengths)
                min_session_length = min(session_lengths)
            else:
                avg_session_length = max_session_length = min_session_length = 0
            
            return {
                'total_sessions': total_sessions,
                'active_sessions': active_sessions,
                'average_session_length': round(avg_session_length, 2),
                'max_session_length': max_session_length,
                'min_session_length': min_session_length,
                'session_engagement_rate': round((active_sessions / total_sessions * 100), 2) if total_sessions > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Error getting chat session analysis: {e}")
            return {'total_sessions': 0, 'active_sessions': 0, 'average_session_length': 0, 'max_session_length': 0, 'min_session_length': 0, 'session_engagement_rate': 0}
    
    def get_peak_usage_hours(self):
        
        try:
            conversations_ref = self.db.collection_group('conversations')
            conversations = conversations_ref.stream()
            
            hourly_usage = defaultdict(int)
            total_conversations = 0
            
            logger.info("Starting peak usage hours analysis...")
            
            for conv in conversations:
                conv_data = conv.to_dict()
                total_conversations += 1
                
                timestamp = conv_data.get('timestamp')
                if timestamp:
                    timestamp = self._ensure_timezone_aware(timestamp)
                    hour = timestamp.hour
                    hourly_usage[hour] += 1
                    
                    # Log first few for debugging
                    if total_conversations <= 5:
                        logger.info(f"Conversation {total_conversations}: {timestamp} (Hour: {hour})")
            
            logger.info(f"Processed {total_conversations} conversations for peak hours analysis")
            logger.info(f"Hourly distribution: {dict(hourly_usage)}")
            
            # Convert to list format for charts (ensure all 24 hours are represented)
            hourly_data = []
            for hour in range(24):
                hourly_data.append({
                    'hour': f"{hour:02d}:00",
                    'usage_count': hourly_usage.get(hour, 0)
                })
            
            # Find peak hour
            if hourly_usage:
                peak_hour_num, peak_count = max(hourly_usage.items(), key=lambda x: x[1])
                peak_hour = f"{peak_hour_num:02d}:00"
            else:
                peak_hour_num, peak_count = 0, 0
                peak_hour = "00:00"
            
            result = {
                'hourly_usage': hourly_data,
                'peak_hour': peak_hour,
                'peak_hour_count': peak_count,
                'total_conversations_analyzed': total_conversations
            }
            
            logger.info(f"Peak hours result: Peak hour {peak_hour} with {peak_count} conversations")
            return result
            
        except Exception as e:
            logger.error(f"Error getting peak usage hours: {e}")
            return {
                'hourly_usage': [],
                'peak_hour': '00:00',
                'peak_hour_count': 0,
                'total_conversations_analyzed': 0,
                'error': str(e)
            }
    
    def get_user_retention_analysis(self):
        
        try:
            users_ref = self.db.collection('users')
            users = users_ref.stream()
            
            # Use timezone-aware datetime for consistency
            now = datetime.now(timezone.utc)
            retention_data = {
                'new_users_last_7_days': 0,
                'new_users_last_30_days': 0,
                'returning_users_last_7_days': 0,
                'returning_users_last_30_days': 0,
                'inactive_users': 0
            }
            
            logger.info("Starting user retention analysis...")
            
            for user in users:
                user_data = user.to_dict()
                created_at = user_data.get('created_at')
                last_login = user_data.get('last_login')
                login_count = user_data.get('login_count', 0)
                
                # Handle created_at with timezone awareness
                if created_at:
                    created_at = self._ensure_timezone_aware(created_at)
                    days_since_creation = (now - created_at).days
                    
                    if days_since_creation <= 7:
                        retention_data['new_users_last_7_days'] += 1
                    if days_since_creation <= 30:
                        retention_data['new_users_last_30_days'] += 1
                
                # Handle last_login with timezone awareness
                if last_login:
                    last_login = self._ensure_timezone_aware(last_login)
                    days_since_last_login = (now - last_login).days
                    
                    if days_since_last_login <= 7 and login_count > 1:
                        retention_data['returning_users_last_7_days'] += 1
                    elif days_since_last_login <= 30 and login_count > 1:
                        retention_data['returning_users_last_30_days'] += 1
                    elif days_since_last_login > 30:
                        retention_data['inactive_users'] += 1
                else:
                    retention_data['inactive_users'] += 1
            
            logger.info(f"User retention analysis completed: {retention_data}")
            return retention_data
            
        except Exception as e:
            logger.error(f"Error getting user retention analysis: {e}")
            return {'new_users_last_7_days': 0, 'new_users_last_30_days': 0, 'returning_users_last_7_days': 0, 'returning_users_last_30_days': 0, 'inactive_users': 0}
    
    def get_response_time_analysis(self):
        
        try:
            conversations_ref = self.db.collection_group('conversations')
            conversations = conversations_ref.stream()
            
            response_times = []
            total_conversations = 0
            
            for conv in conversations:
                conv_data = conv.to_dict()
                total_conversations += 1
                
                # Simulate response time analysis based on message length
                # In real implementation, you'd track actual response times
                user_message = conv_data.get('user_message', '')
                bot_response = conv_data.get('bot_response', '')
                
                # Estimate response time based on response length (mock calculation)
                estimated_response_time = len(bot_response) * 0.01 + 0.5  # seconds
                response_times.append(estimated_response_time)
            
            if response_times:
                avg_response_time = sum(response_times) / len(response_times)
                max_response_time = max(response_times)
                min_response_time = min(response_times)
            else:
                avg_response_time = max_response_time = min_response_time = 0
            
            return {
                'total_responses': total_conversations,
                'average_response_time': round(avg_response_time, 2),
                'max_response_time': round(max_response_time, 2),
                'min_response_time': round(min_response_time, 2),
                'fast_responses': len([t for t in response_times if t < 1.0]),
                'slow_responses': len([t for t in response_times if t > 3.0])
            }
            
        except Exception as e:
            logger.error(f"Error getting response time analysis: {e}")
            return {'total_responses': 0, 'average_response_time': 0, 'max_response_time': 0, 'min_response_time': 0, 'fast_responses': 0, 'slow_responses': 0}
    
    def get_content_category_analysis(self):
       
        try:
            conversations_ref = self.db.collection_group('conversations')
            conversations = conversations_ref.stream()
            
            categories = {
                'symptoms': 0,
                'medications': 0,
                'diagnosis': 0,
                'treatment': 0,
                'prevention': 0,
                'emergency': 0,
                'general_health': 0,
                'nutrition': 0,
                'mental_health': 0,
                'other': 0
            }
            
            # Enhanced keywords for better categorization
            category_keywords = {
                'symptoms': [
                    'symptom', 'pain', 'fever', 'headache', 'nausea', 'cough', 'fatigue',
                    'dizzy', 'chest pain', 'stomach pain', 'back pain', 'sore throat',
                    'shortness of breath', 'vomiting', 'diarrhea', 'constipation',
                    'rash', 'swelling', 'numbness', 'tingling', 'weakness', 'ache',
                    'hurt', 'sore', 'burning', 'itchy', 'blurred vision', 'hearing'
                ],
                'medications': [
                    'medicine', 'drug', 'prescription', 'dosage', 'tablet', 'capsule',
                    'medication', 'pill', 'paracetamol', 'ibuprofen', 'aspirin',
                    'antibiotic', 'insulin', 'vitamins', 'supplements', 'dose',
                    'side effect', 'pharmacy', 'pharmacist', 'generic', 'brand name'
                ],
                'diagnosis': [
                    'diagnosis', 'test', 'scan', 'blood test', 'x-ray', 'mri', 'ct scan',
                    'ultrasound', 'biopsy', 'screening', 'checkup', 'examination',
                    'lab results', 'report', 'finding', 'detected', 'positive', 'negative'
                ],
                'treatment': [
                    'treatment', 'therapy', 'surgery', 'procedure', 'operation',
                    'physiotherapy', 'rehabilitation', 'recovery', 'healing',
                    'cure', 'remedy', 'intervention', 'surgical'
                ],
                'prevention': [
                    'prevent', 'prevention', 'vaccine', 'immunization', 'health tips',
                    'avoid', 'reduce risk', 'protective', 'screening', 'lifestyle',
                    'precaution', 'safety', 'hygiene'
                ],
                'emergency': [
                    'emergency', 'urgent', 'severe', 'critical', 'ambulance', '911',
                    'acute', 'sudden', 'serious', 'life threatening', 'immediate',
                    'hospital', 'er', 'emergency room'
                ],
                'general_health': [
                    'health', 'wellness', 'fitness', 'exercise', 'lifestyle',
                    'healthy living', 'wellbeing', 'activity', 'physical activity',
                    'sleep', 'rest', 'energy', 'routine', 'habits'
                ],
                'nutrition': [
                    'nutrition', 'diet', 'food', 'vitamin', 'mineral', 'calories',
                    'eating', 'meal', 'snack', 'protein', 'carbohydrate', 'fat',
                    'fiber', 'sugar', 'salt', 'water', 'hydration', 'weight'
                ],
                'mental_health': [
                    'stress', 'anxiety', 'depression', 'mental', 'psychology',
                    'therapy', 'counseling', 'mood', 'emotional', 'feelings',
                    'worried', 'sad', 'overwhelmed', 'panic', 'fear', 'cognitive'
                ]
            }
            
            total_queries = 0
            categorized_details = []
            
            logger.info("Starting content category analysis...")
            
            for conv in conversations:
                conv_data = conv.to_dict()
                user_message = conv_data.get('user_message', '').lower()
                
                if not user_message.strip():
                    continue
                    
                total_queries += 1
                
                # Log first few messages for debugging
                if total_queries <= 5:
                    logger.info(f"Message {total_queries}: '{user_message[:50]}...'")
                
                categorized = False
                matched_keywords = []
                
                # Check each category for keyword matches
                for category, keywords in category_keywords.items():
                    found_keywords = [kw for kw in keywords if kw in user_message]
                    if found_keywords:
                        categories[category] += 1
                        categorized = True
                        matched_keywords = found_keywords
                        categorized_details.append({
                            'message': user_message[:100],
                            'category': category,
                            'keywords': found_keywords
                        })
                        break
                
                if not categorized:
                    categories['other'] += 1
                    categorized_details.append({
                        'message': user_message[:100],
                        'category': 'other',
                        'keywords': []
                    })
            
            logger.info(f"Processed {total_queries} conversations for content analysis")
            logger.info(f"Category distribution: {dict(categories)}")
            
            # Calculate percentages and create breakdown
            category_stats = []
            for category, count in categories.items():
                percentage = (count / total_queries * 100) if total_queries > 0 else 0
                if count > 0:  # Only include categories with data
                    category_stats.append({
                        'category': category.replace('_', ' ').title(),
                        'count': count,
                        'percentage': round(percentage, 1)
                    })
            
            # Sort by count (descending)
            category_stats.sort(key=lambda x: x['count'], reverse=True)
            
            # If no categories found, add a placeholder
            if not category_stats:
                category_stats = [{
                    'category': 'No Categorized Content',
                    'count': total_queries,
                    'percentage': 100.0
                }]
            
            result = {
                'total_queries': total_queries,
                'category_breakdown': category_stats,
                'categorized_examples': categorized_details[:10]  # Include some examples
            }
            
            logger.info(f"Content analysis result: {len(category_stats)} categories, top category: {category_stats[0]['category'] if category_stats else 'None'}")
            return result
            
        except Exception as e:
            logger.error(f"Error getting content category analysis: {e}")
            return {
                'total_queries': 0, 
                'category_breakdown': [{
                    'category': 'Error',
                    'count': 0,
                    'percentage': 0.0
                }],
                'categorized_examples': [],
                'error': str(e)
            }
    
    def get_age_category_query_analysis(self):
        """
        Analyze the number of queries by age category
        """
        try:
            # Get all conversations
            conversations_ref = self.db.collection_group('conversations')
            conversations = conversations_ref.stream()
            
            age_query_data = defaultdict(int)
            user_age_cache = {}
            total_queries = 0
            queries_with_age_data = 0
            
            logger.info("Starting age category query analysis...")
            
            for conv in conversations:
                conv_data = conv.to_dict()
                total_queries += 1
                
                # Get user info from the chat reference
                chat_ref = conv.reference.parent.parent
                if not chat_ref:
                    continue
                    
                chat_data = chat_ref.get().to_dict()
                if not chat_data:
                    continue
                    
                user_id = chat_data.get('user_id')
                if not user_id:
                    continue
                
                # Get user age (with caching)
                if user_id not in user_age_cache:
                    users_ref = self.db.collection('users').where('user_id', '==', user_id).limit(1)
                    user_docs = list(users_ref.stream())
                    
                    if user_docs:
                        user_data = user_docs[0].to_dict()
                        age = user_data.get('age')
                        user_age_cache[user_id] = age
                    else:
                        user_age_cache[user_id] = None
                
                age = user_age_cache[user_id]
                
                if age is not None:
                    queries_with_age_data += 1
                    
                    # Categorize by age group
                    if age < 18:
                        age_query_data['Under 18'] += 1
                    elif age < 25:
                        age_query_data['18-24'] += 1
                    elif age < 35:
                        age_query_data['25-34'] += 1
                    elif age < 45:
                        age_query_data['35-44'] += 1
                    elif age < 55:
                        age_query_data['45-54'] += 1
                    elif age < 65:
                        age_query_data['55-64'] += 1
                    else:
                        age_query_data['65+'] += 1
                
                # Log progress for first few queries
                if total_queries <= 5:
                    logger.info(f"Query {total_queries}: User {user_id}, Age: {age}")
            
            logger.info(f"Processed {total_queries} total queries, {queries_with_age_data} with age data")
            logger.info(f"Age category distribution: {dict(age_query_data)}")
            
            # Create sorted breakdown
            age_order = ['Under 18', '18-24', '25-34', '35-44', '45-54', '55-64', '65+']
            age_breakdown = []
            
            for age_group in age_order:
                query_count = age_query_data.get(age_group, 0)
                percentage = (query_count / queries_with_age_data * 100) if queries_with_age_data > 0 else 0
                
                age_breakdown.append({
                    'age_group': age_group,
                    'query_count': query_count,
                    'percentage': round(percentage, 1)
                })
            
            # Find most active age group
            most_active_group = max(age_query_data.items(), key=lambda x: x[1]) if age_query_data else ('Unknown', 0)
            
            result = {
                'total_queries': total_queries,
                'queries_with_age_data': queries_with_age_data,
                'queries_without_age_data': total_queries - queries_with_age_data,
                'age_breakdown': age_breakdown,
                'most_active_age_group': {
                    'age_group': most_active_group[0],
                    'query_count': most_active_group[1]
                },
                'unique_users_analyzed': len(user_age_cache)
            }
            
            logger.info(f"Age analysis result: Most active group is {most_active_group[0]} with {most_active_group[1]} queries")
            return result
            
        except Exception as e:
            logger.error(f"Error getting age category query analysis: {e}")
            return {
                'total_queries': 0,
                'queries_with_age_data': 0,
                'queries_without_age_data': 0,
                'age_breakdown': [],
                'most_active_age_group': {'age_group': 'Unknown', 'query_count': 0},
                'unique_users_analyzed': 0,
                'error': str(e)
            }

# Initialize analytics and query handler
analytics = MedicalAnalytics(db) if db else None

# Initialize query handler with better error handling
try:
    if db:
        from query_handler import DatabaseQueryHandler
        import os
        gemini_api_key = os.getenv('GEMINI_API_KEY')
        if gemini_api_key and gemini_api_key.strip() and gemini_api_key != 'your_gemini_api_key_here':
            query_handler = DatabaseQueryHandler(db, gemini_api_key)
            logger.info("Query handler initialized successfully with Gemini API")
        else:
            query_handler = None
            logger.warning("Gemini API key not properly configured - natural language queries will not work")
    else:
        query_handler = None
        logger.error("Database not initialized - query handler disabled")
except Exception as e:
    logger.error(f"Failed to initialize query handler: {e}")
    query_handler = None

@app.route('/')
def dashboard():
    """Main dashboard page"""
    return render_template('dashboard.html')

@app.route('/api/weekly-users')
def api_weekly_users():
    """API endpoint for weekly active users"""
    if not analytics:
        return jsonify({'error': 'Database not initialized'}), 500
    
    data = analytics.get_weekly_active_users()
    return jsonify(data)

@app.route('/api/user-queries')
def api_user_queries():
    """API endpoint for user query statistics"""
    if not analytics:
        return jsonify({'error': 'Database not initialized'}), 500
    
    data = analytics.get_user_query_statistics()
    return jsonify(data)

@app.route('/api/medicine-search')
@app.route('/api/medicine-search/<medicine_name>')
def api_medicine_search(medicine_name=None):
    """API endpoint for medicine search statistics"""
    if not analytics:
        return jsonify({'error': 'Database not initialized'}), 500
    
    data = analytics.get_medicine_search_stats(medicine_name)
    return jsonify(data)

@app.route('/api/daily-engagement')
def api_daily_engagement():
    """API endpoint for daily user engagement"""
    if not analytics:
        return jsonify({'error': 'Database not initialized'}), 500
    
    data = analytics.get_daily_user_engagement()
    return jsonify(data)

@app.route('/api/demographics')
def api_demographics():
    """API endpoint for user demographics"""
    if not analytics:
        return jsonify({'error': 'Database not initialized'}), 500
    
    try:
        data = analytics.get_user_demographics()
        
        # Log the data for debugging
        logger.info(f"Demographics API response: {data}")
        
        # Ensure proper JSON formatting
        response = {
            'total_users': data.get('total_users', 0),
            'age_distribution': data.get('age_distribution', {}),
            'verification_stats': data.get('verification_stats', {}),
            'oauth_providers': data.get('oauth_providers', {}),
            'profile_completion': data.get('profile_completion', {})
        }
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error in demographics API: {e}")
        return jsonify({
            'error': str(e),
            'total_users': 0,
            'age_distribution': {},
            'verification_stats': {},
            'oauth_providers': {},
            'profile_completion': {}
        }), 500

@app.route('/api/chat-sessions')
def api_chat_sessions():
    """API endpoint for chat session analysis"""
    if not analytics:
        return jsonify({'error': 'Database not initialized'}), 500
    
    data = analytics.get_chat_session_analysis()
    return jsonify(data)

@app.route('/api/peak-hours')
def api_peak_hours():
    """API endpoint for peak usage hours"""
    if not analytics:
        return jsonify({'error': 'Database not initialized'}), 500
    
    data = analytics.get_peak_usage_hours()
    return jsonify(data)

@app.route('/api/retention')
def api_retention():
    """API endpoint for user retention analysis"""
    if not analytics:
        return jsonify({'error': 'Database not initialized'}), 500
    
    data = analytics.get_user_retention_analysis()
    return jsonify(data)

@app.route('/api/response-times')
def api_response_times():
    """API endpoint for response time analysis"""
    if not analytics:
        return jsonify({'error': 'Database not initialized'}), 500
    
    data = analytics.get_response_time_analysis()
    return jsonify(data)

@app.route('/api/content-categories')
def api_content_categories():
    """API endpoint for content category analysis"""
    if not analytics:
        return jsonify({'error': 'Database not initialized'}), 500
    
    data = analytics.get_content_category_analysis()
    return jsonify(data)

@app.route('/api/age-category-queries')
def api_age_category_queries():
    """API endpoint for age category query analysis"""
    if not analytics:
        return jsonify({'error': 'Database not initialized'}), 500
    
    data = analytics.get_age_category_query_analysis()
    return jsonify(data)

@app.route('/api/natural-query', methods=['POST'])
def api_natural_query():
    """API endpoint for natural language database queries"""
    logger.info("Natural query API endpoint called")
    
    if not query_handler:
        error_msg = "Query handler not initialized. Please check Gemini API key configuration."
        logger.error(error_msg)
        return jsonify({
            'success': False,
            'error': error_msg,
            'details': 'Check .env file for GEMINI_API_KEY'
        }), 500
    
    try:
        data = request.get_json()
        logger.info(f"Received request data: {data}")
        
        if not data or 'query' not in data:
            error_msg = "Query parameter is required"
            logger.error(error_msg)
            return jsonify({
                'success': False,
                'error': error_msg
            }), 400
        
        natural_query = data['query'].strip()
        if not natural_query:
            error_msg = "Query cannot be empty"
            logger.error(error_msg)
            return jsonify({
                'success': False,
                'error': error_msg
            }), 400
        
        logger.info(f"Processing natural query: '{natural_query}'")
        
        # Process the query
        result = query_handler.process_natural_query(natural_query)
        
        logger.info(f"Query processing result: {result}")
        
        return jsonify(result)
        
    except Exception as e:
        error_msg = f"Error processing natural query: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return jsonify({
            'success': False,
            'error': error_msg,
            'traceback': str(e)
        }), 500

@app.route('/api/sample-queries')
def api_sample_queries():
    """API endpoint to get sample queries"""
    if not query_handler:
        return jsonify({'error': 'Query handler not initialized'}), 500
    
    sample_queries = query_handler.get_sample_queries()
    return jsonify({'sample_queries': sample_queries})

@app.route('/api/db-structure')
def api_db_structure():
    """API endpoint to get database structure information"""
    if not query_handler:
        return jsonify({'error': 'Query handler not initialized'}), 500
    
    return jsonify({
        'structure': query_handler.db_structure,
        'collections': {
            'users': {
                'fields': ['created_at', 'contact_type', 'age', 'date_of_birth', 'is_active', 
                          'login_count', 'email_verified', 'oauth_id', 'first_name', 'photo_url', 
                          'last_login', 'profile_complete', 'user_id', 'contact', 'oauth_provider', 
                          'display_name', 'last_name'],
                'subcollections': ['chats']
            },
            'chats': {
                'fields': ['created_at', 'title', 'user_id', 'chat_id', 'message_count', 'last_updated'],
                'subcollections': ['conversations']
            },
            'conversations': {
                'fields': ['conversation_id', 'image_url', 'user_message', 'timestamp', 
                          'message_order', 'bot_response'],
                'subcollections': []
            }
        }
    })

@app.route('/api/refresh-status')
def api_refresh_status():
    """API endpoint to get current refresh status and stats"""
    try:
        # Get system stats
        import psutil
        import time
        
        refresh_stats = {
            'server_time': datetime.now().isoformat(),
            'uptime': time.time() - psutil.boot_time(),
            'last_refresh': request.headers.get('X-Last-Refresh', 'Unknown'),
            'database_status': 'connected' if db else 'disconnected',
            'analytics_status': 'enabled' if analytics else 'disabled',
            'query_handler_status': 'enabled' if query_handler else 'disabled',
            'system': {
                'cpu_percent': psutil.cpu_percent(),
                'memory_percent': psutil.virtual_memory().percent,
                'disk_percent': psutil.disk_usage('/').percent if os.name != 'nt' else psutil.disk_usage('C:\\').percent
            }
        }
        
        return jsonify(refresh_stats)
        
    except ImportError:
        # psutil not available, return basic stats
        return jsonify({
            'server_time': datetime.now().isoformat(),
            'database_status': 'connected' if db else 'disconnected',
            'analytics_status': 'enabled' if analytics else 'disabled',
            'query_handler_status': 'enabled' if query_handler else 'disabled'
        })
    except Exception as e:
        logger.error(f"Error getting refresh status: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/refresh-all')
def api_refresh_all():
    """API endpoint to refresh all dashboard data"""
    if not analytics:
        return jsonify({'error': 'Database not initialized'}), 500
    
    try:
        # Collect all data
        all_data = {
            'weeklyUsers': analytics.get_weekly_active_users(),
            'userQueries': analytics.get_user_query_statistics(),
            'medicineSearch': analytics.get_medicine_search_stats(),
            'dailyEngagement': analytics.get_daily_user_engagement(),
            'demographics': analytics.get_user_demographics(),
            'chatSessions': analytics.get_chat_session_analysis(),
            'peakHours': analytics.get_peak_usage_hours(),
            'retention': analytics.get_user_retention_analysis(),
            'responseTimes': analytics.get_response_time_analysis(),
            'contentCategories': analytics.get_content_category_analysis(),
            'ageCategoryQueries': analytics.get_age_category_query_analysis()
        }
        
        return jsonify({
            'success': True,
            'data': all_data,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error refreshing all data: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
