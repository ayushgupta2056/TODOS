from django.db import models
from helpers.models import TrackingModels
from django.contrib.auth.models import (PermissionsMixin,BaseUserManager,AbstractBaseUser)
from .managers import UserManager
from rest_framework_simplejwt.tokens import RefreshToken

# Create your models here.
class User(AbstractBaseUser,PermissionsMixin,BaseUserManager):

    username=models.CharField(max_length=255,unique=True,help_text='less than 255 letters')
    first_name= models.CharField(max_length=150)
    last_name= models.CharField(max_length=150)
    email= models.EmailField(blank=False,unique=True)
    is_active=models.BooleanField(default=True)
    is_staff= models.BooleanField(default=False)


    objects=UserManager()

    EMAIL_FIELD='email'
    USERNAME_FIELD='username'
    REQUIRED_FIELDS=['first_name','last_name','email']

    def __str__(self):
        return self.email
    

    def tokens(self):
        refresh_token=RefreshToken.for_user(self)
        return{
            'refresh_token':str(refresh_token),
            'access_token':str(refresh_token.access_token)
        }
        


    
    
