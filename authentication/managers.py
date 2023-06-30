from django.db import models
from django.contrib.auth.models import BaseUserManager

class UserManager(BaseUserManager):
    def create_user(self,username,first_name,last_name,email,password,**kwargs):
        if username is None:
            raise TypeError('Username not provided')
        if first_name is None:
            raise TypeError('first name not provided')
        if last_name is None:
            raise TypeError('last name not provided')
        if email is None:
            raise TypeError('email not provided')

        
        email=self.normalize_email(email)
        user=self.model(email=email,
                        last_name=last_name,
                        first_name=first_name,
                        username=username,
                        **kwargs)
        user.set_password(password)
        user.save()
        return user
    
    def create_superuser(self,email,first_name,last_name,username,password,**kwargs):
        if username is None:
            raise TypeError('Username not provided')
        if first_name is None:
            raise TypeError('first name not provided')
        if last_name is None:
            raise TypeError('last name not provided')
        if email is None:
            raise TypeError('email not provided')

        
        email=self.normalize_email(email)
        user=self.model(email=email,
                        last_name=last_name,
                        first_name=first_name,
                        username=username,
                        password=password,
                        **kwargs)
        user.is_staff=True
        user.is_superuser=True
        user.save()
        return user





